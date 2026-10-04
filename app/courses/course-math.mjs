import katex from 'katex';
export function renderCourseMath(source,displayMode=false) {
  try {return {html:katex.renderToString(source,{displayMode,output:'htmlAndMathml',throwOnError:true,trust:false,strict:'error',maxExpand:1000,maxSize:20}),error:null};}
  catch {return {html:'',error:'公式暂时无法排版，以下为原始表达式。'};}
}
