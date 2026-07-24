import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <header className="p-6">
        <h1 className="text-3xl font-bold text-primary-700">AgentSims Frontend</h1>
        <p className="mt-2 text-primary-600">React + Vite + TypeScript + Tailwind</p>
      </header>
      <main className="p-6">
        <div className="max-w-4xl mx-auto">
          <section className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">欢迎使用 AgentSims 新前端</h2>
            <p className="text-gray-600">这是一个使用现代工具链构建的前端脚手架，包含：</p>
            <ul className="mt-4 space-y-2 text-gray-600 list-disc list-inside">
              <li>React 18 + Vite</li>
              <li>TypeScript (strict 模式)</li>
              <li>Tailwind CSS</li>
              <li>Zustand 状态管理</li>
              <li>React Router</li>
              <li>Pixi.js v8</li>
              <li>Vitest + Playwright 测试</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
