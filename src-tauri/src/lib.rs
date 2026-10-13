//! FieldGrow · Tauri 后端
//!
//! 职责刻意保持轻薄:
//! - `amap_request`: 代理高德 Web 服务 REST(浏览器直连会被 CORS 拦截),仅放行白名单端点
//! - `export_write`: 把前端生成的导出文件写入用户选择的路径

use serde::Deserialize;

/// 允许代理的高德 REST 端点(白名单,防止被当作通用 HTTP 代理滥用)
const ALLOWED_ENDPOINTS: &[&str] = &[
    "place/text",
    "place/polygon",
    "place/around",
    "place/detail",
    "geocode/geo",
    "geocode/regeo",
];

const AMAP_BASE: &str = "https://restapi.amap.com/v3/";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AmapRequest {
    /// 端点,如 `place/text`
    endpoint: String,
    /// 查询参数(不含 key;key 由前端随参数一并传入)
    params: Vec<(String, String)>,
}

/// 代理一次高德 REST 调用,原样返回 JSON 文本。
#[tauri::command]
async fn amap_request(req: AmapRequest) -> Result<String, String> {
    if !ALLOWED_ENDPOINTS.contains(&req.endpoint.as_str()) {
        return Err(format!("不支持的地图接口: {}", req.endpoint));
    }
    if req.params.iter().all(|(k, _)| k != "key") {
        return Err("缺少高德 API Key".into());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{AMAP_BASE}{}", req.endpoint);
    let resp = client
        .get(&url)
        .query(&req.params)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("地图接口 HTTP {}", resp.status()));
    }
    resp.text().await.map_err(|e| format!("读取响应失败: {e}"))
}

/// 将导出内容写入用户指定的文件(配合前端保存对话框使用)。
#[tauri::command]
fn export_write(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, &data).map_err(|e| format!("写入文件失败: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![amap_request, export_write])
        .run(tauri::generate_context!())
        .expect("error while running FieldGrow");
}
