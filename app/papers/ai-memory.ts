import type {AiMemory, AiSavedResult} from './paper-types';

export function saveResult(memory: AiMemory, result: AiSavedResult, paragraphId?: string): AiMemory {
  if (result.action === 'paragraph' && paragraphId) return {...memory, paragraph: {...memory.paragraph, [paragraphId]: result}};
  if (result.action === 'summary') return {...memory, summary: result};
  if (result.action === 'audit') return {...memory, audit: result};
  if (result.action === 'replication') return {...memory, replication: result};
  if (result.action === 'search') return {...memory, search: result};
  if (result.action === 'chat') return {...memory, chats: [result, ...(memory.chats ?? [])].slice(0,20)};
  return memory;
}
