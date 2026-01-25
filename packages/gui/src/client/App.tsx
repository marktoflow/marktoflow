import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from './components/Canvas/Canvas';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PropertiesPanel } from './components/Panels/PropertiesPanel';
import { PromptInput } from './components/Prompt/PromptInput';

export default function App() {
  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        {/* Left Sidebar - Workflow List & Tools */}
        <Sidebar />

        {/* Main Canvas Area */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 relative">
            <Canvas />
          </div>

          {/* AI Prompt Input */}
          <PromptInput />
        </div>

        {/* Right Panel - Properties */}
        <PropertiesPanel />
      </div>
    </ReactFlowProvider>
  );
}
