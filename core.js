(function(root){
 'use strict';
 const kinds={continent:{label:'Материк',plural:'Материки',icon:'△'},worldpart:{label:'Часть света',plural:'Части света',icon:'◇'},ocean:{label:'Океан',plural:'Океаны',icon:'≈'},sea:{label:'Море',plural:'Моря',icon:'≋'},island:{label:'Остров',plural:'Острова',icon:'◒'},archipelago:{label:'Архипелаг',plural:'Архипелаги',icon:'∴'},peninsula:{label:'Полуостров',plural:'Полуострова',icon:'◩'},river:{label:'Река',plural:'Реки',icon:'∿'},gulf:{label:'Залив',plural:'Заливы',icon:'⌒'},strait:{label:'Пролив',plural:'Проливы',icon:'⋈'},reef:{label:'Риф',plural:'Рифы',icon:'✧'},trench:{label:'Глубоководный жёлоб',plural:'Желоба',icon:'⌄'}};
 function inGroup(o,g){return g==='all'||(g==='school'?o.schoolRequired:o.kind===g||(o.schoolGroups||[]).includes(g));}
 function typeLabel(o){return o.kind==='continent'&&(o.schoolGroups||[]).includes('worldpart')?'Материк · часть света':kinds[o.kind].label;}
 function normalize(value){return String(value).toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/п\s*[-.]?\s*ов\.?/g,'полуостров').replace(/(^|\s)о\.(?=\s)/g,'$1остров').replace(/[^а-яa-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
 function distance(a,b){const p=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let old=p[0];p[0]=i;for(let j=1;j<=b.length;j++){const v=p[j];p[j]=Math.min(p[j]+1,p[j-1]+1,old+(a[i-1]===b[j-1]?0:1));old=v;}}return p[b.length];}
 function search(objects,query,kind='all'){
   const q=normalize(query),tokens=q.split(' ').filter(Boolean);
   return objects.filter(o=>inGroup(o,kind)).map(o=>{
     const hay=normalize([o.name,...o.aliases,kinds[o.kind].label,kinds[o.kind].plural,...(o.schoolGroups||[]).map(g=>kinds[g]?.label||'')].join(' '));
     if(!q)return {o,score:0};
     if(tokens.every(t=>hay.includes(t)))return {o,score:normalize(o.name)===q?100:70};
     const words=hay.split(' ');
     if(tokens.every(t=>words.some(w=>w.includes(t)||(t.length>=5&&distance(t,w)<=Math.min(2,Math.floor(t.length/4))))))return {o,score:20};
     return {o,score:-1};
   }).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score||a.o.name.localeCompare(b.o.name,'ru')).map(x=>x.o);
 }
 function segmentDistance(p,a,b){const x=b[0]-a[0],y=b[1]-a[1],n=x*x+y*y;const t=n?Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/n)):0;return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);}
 function lineDistance(geometry,project,p){let best=Infinity;function visit(g){if(g.type==='GeometryCollection')return g.geometries.forEach(visit);const lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];for(const line of lines)for(let i=1;i<line.length;i++){const a=project(line[i-1]),b=project(line[i]);if(a&&b&&Math.abs(a[0]-b[0])<1000)best=Math.min(best,segmentDistance(p,a,b));}}visit(geometry);return best;}
 function shuffled(array,random=Math.random){const a=[...array];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 const api={kinds,inGroup,typeLabel,normalize,distance,search,segmentDistance,lineDistance,shuffled};
 if(typeof module!=='undefined')module.exports=api;else root.AtlasCore=api;
})(typeof window!=='undefined'?window:globalThis);
