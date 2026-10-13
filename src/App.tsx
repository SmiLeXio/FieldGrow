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
  const [greeted] = useState(() => {
    if (!settings.webKey) {
      setTimeout(() => toast("欢迎使用 FieldGrow — 请先在「设置」中填写高德 Web服务 Key", "info"), 600);
    }
    return true;
  });
  void greeted;

  return (
    <div className="shell">
      <Sidebar view={view} onChange={setView} />
      <main className="main">
        {view === "search" && <SearchView />}
        {view === "pool" && <PoolView />}
        {view === "logs" && <LogsView />}
        {view === "settings" && <SettingsView />}
      </main>
      <ToastStack />
    </div>
  );
}

export default function App() {
  return <Shell />;
}
