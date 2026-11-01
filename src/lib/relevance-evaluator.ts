import { Agent } from '@mastra/core/agent';
import { createOllama } from 'ollama-ai-provider-v2';

export type RelevanceCandidate = {
  title: string; url: string; snippet: string | null; platform: string; phase: string;
  publishedAt: string | null; thumbnailUrl: string | null;
  verificationStatus: 'unverified'; relevanceScore: number; relevanceReason: string;
};
export type RelevanceContext = {
  canonicalTitle: string; searchAliases: string[]; contextKeywords: string[];
  keyPeopleOrEntities: string[]; location: string | null;
};
type Evaluated = RelevanceCandidate & { relevanceScore: number; relevanceReason: string };
type Verdict = { index: number; classification: 'highly_relevant'|'related'|'uncertain'|'unrelated'; score: number; reason: string };

const ollama = createOllama({ baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api' });
const agent = new Agent({
  id: 'dayback-relevance-evaluator',
  name: 'DAYBACK Relevance Evaluator',
  instructions: `Judge whether each candidate is about the exact target event. Do not accept a shared country, person, sport, or broad topic alone. Accept clear paraphrases and alternate names. Different years, matches, tournaments, anniversaries, biographies and unrelated stories are not the target event unless the snippet clearly connects them to it. Use only supplied fields; do not invent facts. Return ONLY JSON: {"results":[{"index":0,"classification":"highly_relevant|related|uncertain|unrelated","score":0,"reason":"short evidence"}]}. Return one result per index. Scores: highly_relevant 80-100, related 60-79, uncertain 35-59, unrelated 0-34. Reasons max 20 words.`,
  model: ollama(process.env.OLLAMA_MODEL || 'qwen3:4b'),
});

const STOP = new Set(['the','and','for','with','from','that','this','was','were','into','after','before','over','under','about','when','where','who','what','how','its','their','his','her','has','have','are','but','not','you','they']);
function terms(value: string): string[] {
  return [...new Set((value.toLowerCase().normalize('NFKD').match(/[a-z0-9]{3,}/g) ?? []).filter(x => !STOP.has(x)))];
}
function fallback(source: RelevanceCandidate, context: RelevanceContext): {score:number; reason:string} {
  const title = new Set(terms(source.title));
  const body = new Set(terms(`${source.title} ${source.snippet ?? ''}`));
  const eventTerms = [...new Set(terms(`${context.canonicalTitle} ${context.searchAliases.join(' ')}`))];
  const entityTerms = [...new Set(terms(context.keyPeopleOrEntities.join(' ')))];
  const contextTerms = [...new Set(terms(`${context.contextKeywords.join(' ')} ${context.location ?? ''}`))];
  const titleHits = eventTerms.filter(t => title.has(t));
  const bodyHits = eventTerms.filter(t => body.has(t));
  const entityHits = entityTerms.filter(t => body.has(t));
  const contextHits = contextTerms.filter(t => body.has(t));
  const score = Math.min(100, Math.round(
    (titleHits.length / Math.max(1, Math.min(4,eventTerms.length))) * 45 +
    (bodyHits.length / Math.max(1, Math.min(6,eventTerms.length))) * 25 +
    (entityHits.length / Math.max(1, Math.min(4,entityTerms.length))) * 20 +
    (contextHits.length / Math.max(1, Math.min(4,contextTerms.length))) * 10
  ));
  return { score, reason: `Lexical evidence: ${titleHits.length} event terms in title; ${entityHits.length} entity terms in text.` };
}
function parseJson(raw: string): {results?:Verdict[]} {
  const noThink = raw.includes('</think>') ? raw.slice(raw.lastIndexOf('</think>')+8) : raw;
  const cleaned = noThink.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const a=cleaned.indexOf('{'), b=cleaned.lastIndexOf('}');
  if(a<0||b<=a) throw new Error('Relevance model returned no JSON object');
  return JSON.parse(cleaned.slice(a,b+1)) as {results?:Verdict[]};
}
export async function evaluateSourceRelevance(
  sources: RelevanceCandidate[], context: RelevanceContext,
): Promise<{sources:Evaluated[]; rejectedCount:number; usedFallback:boolean}> {
  const kept: Evaluated[]=[]; let rejectedCount=0; let usedFallback=false;
  const batches: RelevanceCandidate[][]=[];
  for(let i=0;i<sources.length;i+=12) batches.push(sources.slice(i,i+12));
  // Two local inference batches at once; avoid saturating modest machines.
  let cursor=0;
  const worker=async()=>{
    while(true){
      const batchIndex=cursor++;
      if(batchIndex>=batches.length) return;
      const batch=batches[batchIndex];
      const fallbackScores=batch.map(s=>fallback(s,context));
      try {
        const payload={event:{title:context.canonicalTitle,aliases:context.searchAliases,entities:context.keyPeopleOrEntities,keywords:context.contextKeywords,location:context.location},
          candidates:batch.map((s,index)=>({index,title:s.title.slice(0,300),snippet:s.snippet?.slice(0,500)??null,url:s.url,platform:s.platform,phase:s.phase}))};
        const response=await agent.generate(`/no_think\nEvaluate the candidates. Return JSON only.\n${JSON.stringify(payload)}`);
        const parsed=parseJson(response.text);
        if(!Array.isArray(parsed.results)) throw new Error('Missing results array');
        const byIndex=new Map<number,Verdict>();
        for(const v of parsed.results) if(Number.isInteger(v.index)&&v.index>=0&&v.index<batch.length&&
          ['highly_relevant','related','uncertain','unrelated'].includes(v.classification)&&Number.isFinite(v.score)) byIndex.set(v.index,v);
        batch.forEach((source,index)=>{
          const v=byIndex.get(index);
          if(!v){usedFallback=true; const f=fallbackScores[index]; if(f.score>=48)kept.push({...source,relevanceScore:f.score,relevanceReason:f.reason});else rejectedCount++;return;}
          if(v.classification==='unrelated'||v.score<35){rejectedCount++;return;}
          if(v.classification==='uncertain'&&fallbackScores[index].score<35){rejectedCount++;return;}
          kept.push({...source,relevanceScore:Math.max(0,Math.min(100,Math.round(v.score))),relevanceReason:String(v.reason||'Semantic match').slice(0,180)});
        });
      } catch(e) {
        usedFallback=true;
        console.warn(`[DAYBACK][RELEVANCE] batch fallback: ${e instanceof Error?e.message:'unknown error'}`);
        batch.forEach((source,index)=>{const f=fallbackScores[index];if(f.score>=48)kept.push({...source,relevanceScore:f.score,relevanceReason:f.reason});else rejectedCount++;});
      }
    }
  };
  await Promise.all(Array.from({length:Math.min(2,batches.length)},()=>worker()));
  console.log(`[DAYBACK][RELEVANCE] input=${sources.length} retained=${kept.length} rejected=${rejectedCount} fallback=${usedFallback}`);
  return {sources:kept,rejectedCount,usedFallback};
}
