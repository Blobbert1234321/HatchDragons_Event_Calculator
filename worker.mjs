import {calculate} from './engines.mjs';
self.onmessage=({data})=>{
  try{
    const result=calculate(data.type,data.settings,p=>self.postMessage({progress:p}));
    self.postMessage({result});
  }catch(error){self.postMessage({error:error.message||String(error)});}
};
