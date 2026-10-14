import { useState } from "react";
import { Sidebar, type ViewKey } from "./components/Sidebar";
import { ToastStack, useApp } from "./lib/appContext";
import { LogsView } from "./views/LogsView";
import { PoolView } from "./views/PoolView";
import { SearchView } from "./views/SearchView";
import { SettingsView } from "./views/SettingsView";

function Shell() {
  const [view, setView] = useState<ViewKey>("search");
  const { settings, toast } = useApp();

  // 首次进入且未配置 Key 时,引导用户去设置
  useState(() => {
    if (!settings.webKey) {
      setTimeout(() => toast("欢迎使用 FieldGrow — 请先在「设置」中填写高德 Web服务 Key", "info"), 600);
    }
  });

  return (
    <div className="shell">
      <Sidebar view={view} onChange={setView} />
      <main className="main">
        {/* 所有视图常驻挂载、仅切换显示 —— 页面间状态(检索结果/表单/筛选)不丢失 */}
        <div className="view-host" style={{ display: view === "search" ? "flex" : "none" }}>
          <SearchView onGoSettings={() => setView("settings")} />
        </div>
        <div className="view-host" style={{ display: view === "pool" ? "flex" : "none" }}>
          <PoolView />
        </div>
        <div className="view-host" style={{ display: view === "logs" ? "flex" : "none" }}>
          <LogsView />
        </div>
        <div className="view-host" style={{ display: view === "settings" ? "flex" : "none" }}>
          <SettingsView />
        </div>
      </main>
      <ToastStack />
    </div>
  );
}

export default function App() {
  return <Shell />;
}
