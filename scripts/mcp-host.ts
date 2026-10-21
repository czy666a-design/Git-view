// Development-only standard MCP Apps host; it is not Codex native-host verification.
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
const token = new URLSearchParams(location.hash.slice(1)).get('dev') || '';
const call = async (action: string, params: Record<string,any> = {}) => {
  const response = await fetch('/api',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action,...params})});
  const result = await response.json(); return {content:[{type:'text' as const,text:result.error?.message || 'ok'}],structuredContent:result,isError:!!result.error};
};
const names: Record<string,string> = { open_project_versions:'open',get_git_graph:'graph',get_git_commit:'commit',get_git_branch:'branch',get_git_changes:'working',get_git_diff:'diff',prepare_git_handoff:'handoff',project_versions_ready:'ready' };
const bridge = new AppBridge(null,{name:'MCP Apps Test Host',version:'1.0.0'},{serverTools:{},message:{},openLinks:{}},{hostContext:{theme:'dark',displayMode:'inline',availableDisplayModes:['inline','fullscreen']}});
bridge.oncalltool = params => call(names[params.name] || 'unknown', params.arguments || {});
bridge.onmessage = async params => { (window as any).__messages = [...((window as any).__messages || []),params]; return {}; };
const frame = document.createElement('iframe'); frame.title = 'Gitview'; frame.style.cssText = 'border:0;width:100%;height:100vh;display:block'; document.body.style.margin = '0'; document.body.append(frame);
bridge.oninitialized = async () => { await bridge.sendToolInput({arguments:{}}); await bridge.sendToolResult(new URLSearchParams(location.hash.slice(1)).has('projectRequired') ? { content:[{type:'text',text:'请选择项目'}], structuredContent:{projectRequired:true} } : await call('binding')); };
await bridge.connect(new PostMessageTransport(frame.contentWindow!,frame.contentWindow!)); frame.srcdoc = await (await fetch('/')).text();
