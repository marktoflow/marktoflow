import { ScriptTool, ToolConfig, SDKInitializer } from '@marktoflow/core';

export const ScriptInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const scriptPath = config.options?.['path'] as string;
    if (!scriptPath) {
      throw new Error('Script integration requires options.path');
    }
    
    const toolsDir = config.options?.['toolsDir'] as string;
    const tool = new ScriptTool(scriptPath, toolsDir);
    
    // We return a proxy that maps method calls to tool.execute(method, args)
    return new Proxy(tool, {
      get: (target, prop) => {
        if (typeof prop === 'string' && prop !== 'then') {
          return (params: Record<string, any>) => target.execute(prop, params);
        }
        return Reflect.get(target, prop);
      }
    });
  },
};
