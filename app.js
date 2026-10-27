/* Мир рядом. All geography is loaded locally; no network calls or accounts. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
if(!window.d3||!d3.geoGinzburg9||!window.ATLAS_DATA||!window.CLASSROOM_MAP||!window.AtlasCore){$('workspace').innerHTML='<p class="fatal-error">Не удалось загрузить карту. Если открываешь скачанную версию, сначала распакуй весь архив и открой index.html из папки.</p>';return;}
const {kinds,inGroup,typeLabel,search,lineDistance,shuffled}=AtlasCore, data=ATLAS_DATA, objects=data.objects;
const byId=new Map(objects.map(o=>[o.id,o]));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let progress={opened:[],learned:[],rounds:0}, storageOK=true;
try{const old=JSON.parse(localStorage.getItem('mir-ryadom-v1')||'null');if(old&&typeof old==='object')progress={opened:Array.isArray(old.opened)?old.opened.filter(id=>byId.has(id)):[],learned:Array.isArray(old.learned)?old.learned.filter(id=>byId.has(id)):[],rounds:Number.isFinite(old.rounds)?old.rounds:0};}catch{storageOK=false;}
let mode='atlas',filter='all',selected=null,atlasSelected=null,session=null,quizKind='school';
let mapStyle='school';try{if(localStorage.getItem('mir-ryadom-map-style')==='simple')mapStyle='simple';}catch{}
let width=0,height=0,projection,path,transform=d3.zoomIdentity,keyboard=null,currentResults=[];
let physicalFrame=null;
const svg=d3.select('#map-svg'),world=svg.append('g'),sphere=world.append('path').attr('fill','#d6eae7'),grid=world.append('path').attr('class','graticule'),equator=world.append('path').attr('class','equator'),land=world.append('path').attr('class','land'),riverGroup=world.append('g'),selectionPath=world.append('path').attr('class','selection-path'),labelLayer=svg.append('g');
const raster=world.insert('image',':first-child').attr('class','school-raster').attr('href',CLASSROOM_MAP.image).attr('preserveAspectRatio','none').on('error',()=>{$('map-load-error').hidden=mapStyle!=='school';}).on('load',()=>{$('map-load-error').hidden=true;});
const riverData=objects.filter(o=>o.kind==='river');
const riverPaths=riverGroup.selectAll('path').data(riverData).join('path').attr('class','river-base');
const zoom=d3.zoom().scaleExtent([1,26]).clickDistance(8).on('zoom',event=>{transform=event.transform;world.attr('transform',transform);updateOverlays();});
svg.call(zoom).on('dblclick.zoom',null);
svg.on('click.atlas',event=>{if(event.defaultPrevented)return;const p=d3.pointer(event,svg.node());keyboard=null;$('keyboard-cursor').hidden=true;submitPoint(p);});
function save(){try{localStorage.setItem('mir-ryadom-v1',JSON.stringify(progress));}catch{storageOK=false;}$('storage-status').textContent=storageOK?'Прогресс сохраняется на этом устройстве':'Прогресс доступен до закрытия страницы: браузер запретил сохранение';updateCounters();}
function updateCounters(){$('opened-count').textContent=`${new Set(progress.opened).size} из ${objects.length}`;$('object-count').textContent=objects.length;$('source-count').textContent=`${objects.length} объектов`;}
function opened(o){if(!progress.opened.includes(o.id)){progress.opened.push(o.id);save();}}
function renderFilters(){$('filters').innerHTML=[['all','Все'],['school','По списку'],...Object.entries(kinds).map(([id,k])=>[id,k.plural])].map(([id,name])=>`<button data-filter="${id}" class="${filter===id?'active':''}" aria-pressed="${filter===id}">${name}</button>`).join('');}
function renderResults(){currentResults=search(objects,$('search').value,filter);$('results-count').textContent=$('search').value?`Найдено: ${currentResults.length}`:`${filter==='all'?'Все объекты':filter==='school'?'Школьный список':kinds[filter].plural} · ${currentResults.length}`;
 $('results').innerHTML=currentResults.length?currentResults.map(o=>`<button class="result" data-object="${o.id}" data-kind="${o.kind}" aria-current="${selected?.id===o.id}"><span class="result-icon" aria-hidden="true">${kinds[o.kind].icon}</span><span><span class="result-title">${escape(o.name)}</span><span class="result-type">${typeLabel(o)}${o.schoolRequired?'':' · дополнительно'}${progress.opened.includes(o.id)?' · открыто':''}</span></span>${icon('arrow')}</button>`).join(''):'<div class="empty-results">Такого объекта пока нет в выбранной категории. Попробуй другое название или выбери «Все».<br><button class="text-button" data-clear>Сбросить поиск ↗</button></div>';
}
function sourceURL(o){if(o.source.url)return o.source.url;return data.sources.find(s=>s.dataset===o.source.dataset)?.url||'https://www.naturalearthdata.com/';}
function renderDetail(){const o=selected;
 if(!o){$('detail-panel').innerHTML=`<div class="welcome"><span class="welcome-icon">${icon('compass')}</span><h2>Начни с любопытства</h2><p>Введи название или выбери место из списка. Карта приблизится, а подпись станет крупнее.</p><div class="example-buttons"><button data-object="black">Чёрное море ↗</button><button data-object="hindustan">Индостан ↗</button><button data-object="new-guinea">Новая Гвинея ↗</button></div></div>`;return;}
 $('detail-panel').innerHTML=`<div class="kind-pill"><span></span>${typeLabel(o)}</div><h2>${escape(o.name)}</h2><p>${escape(o.where)}</p><div class="fact-box"><strong>${icon('spark')}ЗАПОМНИ ОДНУ ВЕЩЬ</strong><p>${escape(o.fact)}</p></div><a class="source-link" href="${escape(sourceURL(o))}" target="_blank" rel="noopener">${escape(o.source.label||'Геоданные: Natural Earth')} ↗</a><p class="selected-note">Метка показывает положение, а не границы объекта.</p>`;
}
function choose(id,focus=true){const o=byId.get(id);if(!o)return;selected=o;if(mode==='atlas')atlasSelected=o;opened(o);renderDetail();renderResults();renderSelection();if(focus)focusObject(o);else updateOverlays();}
function schoolProjection(){
 const c=CLASSROOM_MAP,a=c.affine.x,b=c.affine.y;
 const s=Math.min((width-20)/c.width,(height-140)/c.height),dx=(width-c.width*s)/2,dy=70+(height-140-c.height*s)/2;
 const raw=d3.geoGinzburg9().rotate([-c.center,0]).scale(1).translate([0,0]);
 const toImage=q=>[a[0]*q[0]+a[1]*q[1]+a[2],b[0]*q[0]+b[1]*q[1]+b[2]];
 const imageToScreen=p=>[dx+s*p[0],dy+s*p[1]];
 const p=ll=>imageToScreen(toImage(raw(ll)));
 p.invert=q=>{const x=(q[0]-dx)/s-a[2],y=(q[1]-dy)/s-b[2],det=a[0]*b[1]-a[1]*b[0];return raw.invert([(x*b[1]-y*a[1])/det,(y*a[0]-x*b[0])/det]);};
 p.stream=out=>raw.stream(d3.geoTransform({point(x,y){const q=imageToScreen(toImage([x,y]));this.stream.point(q[0],q[1]);}}).stream(out));
 physicalFrame={s,dx,dy,imageToScreen};return p;
}
function objectPoint(o){return mapStyle==='school'&&CLASSROOM_MAP.anchors[o.id]?physicalFrame.imageToScreen(CLASSROOM_MAP.anchors[o.id]):projection(o.point);}
function objectScreen(o){return transform.apply(objectPoint(o));}
function renderMap(){
 const r=$('map').getBoundingClientRect();width=Math.max(200,r.width);height=Math.max(250,r.height);svg.attr('viewBox',`0 0 ${width} ${height}`);
 projection=mapStyle==='school'?schoolProjection():d3.geoEqualEarth().rotate([0,0]).fitExtent([[15,70],[width-15,height-73]],{type:'Sphere'});
 path=d3.geoPath(projection);zoom.extent([[0,0],[width,height]]).translateExtent([[-width,-height],[width*2,height*2]]);
 $('map-panel').classList.toggle('school-map',mapStyle==='school');$('school-map').setAttribute('aria-pressed',mapStyle==='school');$('simple-map').setAttribute('aria-pressed',mapStyle==='simple');
 $('grid-toggle').closest('label').hidden=mapStyle==='school';$('labels-caption').textContent=mapStyle==='school'?'Метки атласа':'Подписи';
 $('map-credit').textContent=mapStyle==='school'?'Карта: 1maps.ru · метки: Natural Earth':'Геоданные: Natural Earth';$('map-credit').href=mapStyle==='school'?CLASSROOM_MAP.source.original:'https://www.naturalearthdata.com/';
 redrawGeometry();svg.call(zoom.transform,d3.zoomIdentity);if(selected)focusObject(selected,false);
}
function redrawGeometry(){const school=mapStyle==='school';raster.style('display',school?null:'none');for(const el of [sphere,grid,equator,land,riverGroup])el.style('display',school?'none':null);if(school){const f=physicalFrame;raster.attr('x',f.dx).attr('y',f.dy).attr('width',CLASSROOM_MAP.width*f.s).attr('height',CLASSROOM_MAP.height*f.s);}else{sphere.attr('d',path({type:'Sphere'}));grid.attr('d',path(d3.geoGraticule10()));equator.attr('d',path({type:'LineString',coordinates:[[-180,0],[-90,0],[0,0],[90,0],[180,0]]}));land.attr('d',path(data.land));riverPaths.attr('d',o=>path(o.geometry));}renderSelection();}
function renderSelection(){if(!path)return;selectionPath.attr('d',mapStyle==='simple'&&selected&&['continent','worldpart','river'].includes(selected.kind)?path(selected.geometry):null).attr('class',`selection-path${selected?.kind==='river'?' river':''}`);$('map-status').textContent=selected?selected.name:(mode==='quiz'&&session&&!session.complete?'Найди объект на карте':mapStyle==='school'?'Школьная физическая карта':'Весь мир перед тобой');updateOverlays();}
function screen(p){return transform.apply(projection(p));}
function focusObject(o,animate=true){
 if(!projection)return;svg.interrupt();if(mapStyle==='simple')projection.rotate([-o.point[0],0]);redrawGeometry();
 let k;
 if(o.kind==='ocean')k=o.id==='arctic'?1.7:1.25;
 else if(o.kind==='continent'||o.kind==='worldpart'){const b=path.bounds(o.geometry),dx=b[1][0]-b[0][0],dy=b[1][1]-b[0][1];k=Math.max(1.25,Math.min(3.8,.70/Math.max(dx/width,dy/height)));}
 else{const b=path.bounds(o.geometry),span=Math.max((b[1][0]-b[0][0])/width,(b[1][1]-b[0][1])/height);k=o.pointOnly?7:Math.max(3.5,Math.min(14,.55/(span||.08)));if(o.kind==='river')k=Math.min(7,k);}
 if(mapStyle==='school')k=Math.min(11,k);
 const p=objectPoint(o);const t=d3.zoomIdentity.translate(width/2,height*.52).scale(k).translate(-p[0],-p[1]);
 if(animate&&!reduceMotion)svg.transition().duration(650).call(zoom.transform,t);else svg.call(zoom.transform,t);
}
function home(){svg.interrupt();if(mapStyle==='simple')projection.rotate([0,0]);redrawGeometry();svg.call(zoom.transform,d3.zoomIdentity);keyboard=null;$('keyboard-cursor').hidden=true;}
function updateOverlays(){if(!projection)return;
 const marker=$('selection-marker');if(selected){const p=objectScreen(selected);marker.hidden=p[0]<10||p[0]>width-10||p[1]<40||p[1]>height-50;marker.style.left=p[0]+'px';marker.style.top=p[1]+'px';$('marker-name').textContent=selected.name;}else marker.hidden=true;
 const hide=mode==='quiz'&&session&&!session.complete&&!session.answered;
 $('labels-toggle').disabled=hide;
 const labels=hide||!$('labels-toggle').checked||(mapStyle==='school'&&transform.k<2.4)?[]:objects.filter(o=>o.id!==selected?.id&&(['continent','ocean'].includes(o.kind)||transform.k>=3.3));
 const occupied=[];const visible=[];
 for(const o of labels){const p=objectScreen(o);if(p[0]<38||p[0]>width-38||p[1]<105||p[1]>height-65)continue;const line=o.name.replace('Полуостров ','').replace(' полуостров','');const len=Math.min(160,line.length*(o.kind==='continent'?5.8:4.8));const b=[p[0]-len/2,p[1]-10,p[0]+len/2,p[1]+10];if(occupied.some(q=>b[0]<q[2]+8&&b[2]>q[0]-8&&b[1]<q[3]+9&&b[3]>q[1]-9))continue;occupied.push(b);visible.push({o,p,line});}
 labelLayer.selectAll('text').data(visible,x=>x.o.id).join('text').attr('class',x=>'map-label'+(x.o.kind==='ocean'?' water':['continent'].includes(x.o.kind)?'':' minor')).attr('x',x=>x.p[0]).attr('y',x=>x.p[1]).text(x=>x.line);
 grid.style('display',mapStyle==='simple'&&$('grid-toggle').checked?null:'none');equator.style('display',mapStyle==='simple'&&$('grid-toggle').checked?null:'none');
 if(keyboard){$('keyboard-cursor').style.left=keyboard[0]+'px';$('keyboard-cursor').style.top=keyboard[1]+'px';}
}
function hit(o,p){const raw=transform.invert(p);let checkPoint=raw;if(mapStyle==='school'){const reference=projection(o.point),registered=objectPoint(o);checkPoint=[raw[0]+reference[0]-registered[0],raw[1]+reference[1]-registered[1]];}const coord=projection.invert(checkPoint);if(!coord||!Number.isFinite(coord[0]))return false;const tolerance=matchMedia('(pointer:coarse)').matches?23:15;
 const anchor=objectScreen(o);if(Math.hypot(anchor[0]-p[0],anchor[1]-p[1])<=tolerance)return true;
 if(mapStyle==='school'){const f=physicalFrame,ix=(raw[0]-f.dx)/f.s,iy=(raw[1]-f.dy)/f.s;if(ix<0||ix>CLASSROOM_MAP.width||iy<0||iy>CLASSROOM_MAP.height)return false;}
 if(o.check==='south-of-60')return coord[1]<=-60&&!d3.geoContains(data.land,coord);
 if(o.answerBox){const [west,south,east,north]=o.answerBox;return coord[0]>=west&&coord[0]<=east&&coord[1]>=south&&coord[1]<=north&&!d3.geoContains(data.land,coord);}
 if(o.kind==='river')return lineDistance(o.geometry,screen,p)<=tolerance;
 if(!o.pointOnly&&d3.geoContains(o.geometry,coord))return true;
 return false;
}
let clickTimer;
function submitPoint(p){
 if(mode==='quiz'&&session&&!session.complete){if(session.answered)return;const o=byId.get(session.queue[session.index]);if(hit(o,p)){session.answered=true;session.found++;if(session.attempts===0&&!session.hinted)session.firstTry++;if(!session.hinted&&!progress.learned.includes(o.id)){progress.learned.push(o.id);save();}session.results.push({id:o.id,found:true,hinted:session.hinted});choose(o.id);renderQuiz();$('quiz-next')?.focus({preventScroll:true});}else{session.attempts++;session.feedback='Пока чуть в стороне. Приблизь карту и попробуй ещё — попытки не ограничены.';const el=$('click-marker');el.hidden=false;el.style.left=p[0]+'px';el.style.top=p[1]+'px';clearTimeout(clickTimer);clickTimer=setTimeout(()=>el.hidden=true,1800);renderQuiz();}return;}
 if(mode==='quiz')return;
 const hits=objects.filter(o=>hit(o,p));if(hits.length){hits.sort((a,b)=>{const rank={strait:0,gulf:1,sea:2,reef:3,island:4,archipelago:5,peninsula:6,river:7,trench:8,continent:9,worldpart:10,ocean:11};return rank[a.kind]-rank[b.kind]||d3.geoArea(a.geometry)-d3.geoArea(b.geometry);});choose(hits[0].id);}
}
function setMode(next){mode=next;$('atlas-tab').classList.toggle('active',mode==='atlas');$('atlas-tab').setAttribute('aria-pressed',mode==='atlas');$('quiz-tab').classList.toggle('active',mode==='quiz');$('quiz-tab').setAttribute('aria-pressed',mode==='quiz');$('search-panel').hidden=mode==='quiz';$('detail-panel').hidden=mode==='quiz';$('quiz-panel').hidden=mode!=='quiz';$('map-panel').classList.toggle('quiz-map',mode==='quiz');$('click-marker').hidden=true;
 if(mode==='atlas'){selected=atlasSelected;renderResults();renderDetail();renderSelection();if(selected)focusObject(selected);else home();$('map-instruction').textContent='Перетаскивай карту · Приближай кнопками или жестами';}
 else{selected=session?.answered?byId.get(session.queue[session.index]):null;renderQuiz();home();if(selected)focusObject(selected);$('map-instruction').textContent='Нажми на карте · Можно приблизить · Клавиатура: стрелки и Enter';}
}
function startQuiz(){const pool=objects.filter(o=>inGroup(o,quizKind));const fresh=shuffled(pool.filter(o=>!progress.learned.includes(o.id))),old=shuffled(pool.filter(o=>progress.learned.includes(o.id)));const queue=[...fresh,...old].slice(0,5).map(o=>o.id);session={queue,index:0,found:0,firstTry:0,results:[],answered:false,hinted:false,attempts:0,feedback:'',complete:false};selected=null;home();renderQuiz();renderSelection();}
function renderQuiz(){const panel=$('quiz-panel');
 if(!session){panel.innerHTML=`<div class="quiz-symbol">${icon('target')}</div><span class="eyebrow">МАЛЕНЬКАЯ ЭКСПЕДИЦИЯ</span><h2>${mapStyle==='school'?'Найди на карте,<br>как в классе.':'А теперь —<br>без названий?'}</h2><p class="quiz-intro">Ты получишь название и попробуешь найти место на карте. До пяти заданий, сколько угодно попыток и подсказка рядом.</p><label for="quiz-kind">Что будем искать?</label><select id="quiz-kind"><option value="school" ${quizKind==='school'?'selected':''}>Школьный список · ${data.schoolList.objectCount}</option><option value="all" ${quizKind==='all'?'selected':''}>Весь набор · ${objects.length}</option>${Object.entries(kinds).map(([id,k])=>`<option value="${id}" ${quizKind===id?'selected':''}>${k.plural} · ${objects.filter(o=>inGroup(o,id)).length}</option>`).join('')}</select><button id="quiz-start" class="primary-button">Отправиться в экспедицию${icon('arrow')}</button><p class="quiz-fineprint">Без таймера и оценок. Можно приблизить карту, воспользоваться подсказкой или посмотреть ответ.${mapStyle==='school'?' Печатные названия остаются видны, как на школьной карте.':''}</p><div class="learned-total">Уже найдено без подсказок: <strong>${progress.learned.length} из ${objects.length}</strong></div>`;return;}
 if(session.complete){panel.innerHTML=`<span class="eyebrow">ЭКСПЕДИЦИЯ ЗАВЕРШЕНА</span><h2>Мир стал<br>чуть знакомее.</h2><div class="quiz-score"><strong>${session.found}/${session.queue.length}</strong><span>мест найдено</span></div><p class="quiz-intro">С первой попытки и без подсказки: <strong>${session.firstTry}</strong>. Возвращайся к сложным местам — так они запоминаются.</p><ul class="quiz-summary-list">${session.results.map(r=>`<li>${escape(byId.get(r.id).name)} ${r.found?(r.hinted?'· с подсказкой':'· найдено'):'· разобрали ответ'}</li>`).join('')}</ul><button id="quiz-again" class="primary-button">Ещё одна экспедиция${icon('arrow')}</button><button id="quiz-settings" class="text-button quiz-exit">Выбрать другую категорию</button><div class="learned-total">Уже найдено без подсказок: <strong>${progress.learned.length} из ${objects.length}</strong></div>`;return;}
 const o=byId.get(session.queue[session.index]);const done=session.index+(session.answered?1:0);const revealed=session.results.at(-1)?.id===o.id&&!session.results.at(-1)?.found;
 panel.innerHTML=`<div class="quiz-progress-title"><span>ТВОЯ ЭКСПЕДИЦИЯ</span><span>${done} / ${session.queue.length}</span></div><div class="progress-track" role="progressbar" aria-label="Прогресс экспедиции" aria-valuemin="0" aria-valuemax="${session.queue.length}" aria-valuenow="${done}"><span style="width:${done/session.queue.length*100}%"></span></div><p class="quiz-task-label">${session.answered?'ТЕПЕРЬ ТЫ ЗНАЕШЬ':'НАЙДИ НА КАРТЕ'}</p><span class="quiz-kind">${typeLabel(o)}</span><h2 class="quiz-object-name">${escape(o.name)}</h2>${session.answered?`<div class="feedback correct" role="status">${revealed?'Вот где находится это место. Рассмотри карту — и попробуем дальше.':'Верно! Ты нашёл нужное место.'}</div><p class="answer-fact">${escape(o.fact)}</p><button id="quiz-next" class="primary-button">${session.index===session.queue.length-1?'Посмотреть результат':'Следующее место'}${icon('arrow')}</button>`:`<p class="quiz-instruction">Нажми там, где находится объект. Для маленького места сначала приблизь карту.</p>${session.feedback?`<div class="feedback" role="status">${escape(session.feedback)}</div>`:''}${session.hinted?`<div class="hint-box">${icon('spark')} <strong>Ориентир:</strong><br>${escape(o.hint)}</div>`:''}<div class="quiz-actions"><button id="quiz-hint" class="secondary-button" ${session.hinted?'disabled':''}>${session.hinted?'Подсказка открыта':'Нужна подсказка'}</button><button id="quiz-reveal" class="text-button">Показать и запомнить ответ ↗</button></div>`}<button id="quiz-back" class="text-button quiz-exit">← Вернуться к исследованию</button><div class="learned-total">Найдено в этой экспедиции: <strong>${session.found}</strong><br>Можно ошибаться. Главное — пробовать.</div>`;
}
function reveal(){if(!session||session.answered)return;const o=byId.get(session.queue[session.index]);session.answered=true;session.results.push({id:o.id,found:false,hinted:true});choose(o.id);renderQuiz();$('quiz-next')?.focus({preventScroll:true});}
function nextQuiz(){if(!session?.answered)return;if(session.index===session.queue.length-1){session.complete=true;progress.rounds++;save();renderQuiz();return;}session.index++;session.answered=false;session.hinted=false;session.attempts=0;session.feedback='';selected=null;home();renderSelection();renderQuiz();}
document.addEventListener('click',event=>{
 const obj=event.target.closest('[data-object]');if(obj&&mode==='atlas'){choose(obj.dataset.object);return;}
 const f=event.target.closest('[data-filter]');if(f){filter=f.dataset.filter;renderFilters();renderResults();return;}
 if(event.target.closest('[data-clear]')){$('search').value='';filter='all';renderFilters();renderResults();$('search').focus();return;}
 if(event.target.closest('#quiz-start')||event.target.closest('#quiz-again')){startQuiz();return;}
 if(event.target.closest('#quiz-hint')&&session&&!session.answered){session.hinted=true;renderQuiz();return;}
 if(event.target.closest('#quiz-reveal')){reveal();return;}
 if(event.target.closest('#quiz-next')){nextQuiz();return;}
 if(event.target.closest('#quiz-settings')){session=null;selected=null;renderQuiz();home();renderSelection();return;}
 if(event.target.closest('#quiz-back'))setMode('atlas');
});
document.addEventListener('change',event=>{if(event.target.id==='quiz-kind')quizKind=event.target.value;});
$('search').addEventListener('input',renderResults);
$('search').addEventListener('keydown',event=>{if(event.key==='Enter'&&currentResults.length){choose(currentResults[0].id);}if(event.key==='Escape'){$('search').value='';renderResults();}});
$('atlas-tab').onclick=()=>setMode('atlas');$('quiz-tab').onclick=()=>setMode('quiz');$('start-bottom').onclick=()=>{setMode('quiz');$('quiz-panel').scrollIntoView({behavior:reduceMotion?'instant':'smooth',block:'nearest'});};
$('world-button').onclick=home;
 function changeMapStyle(style){mapStyle=style;try{localStorage.setItem('mir-ryadom-map-style',style);}catch{}$('map-load-error').hidden=true;renderMap();if(mode==='quiz')renderQuiz();}
 $('school-map').onclick=()=>changeMapStyle('school');$('simple-map').onclick=()=>changeMapStyle('simple');
$('zoom-in').onclick=()=>svg.transition().duration(reduceMotion?0:250).call(zoom.scaleBy,1.65);
$('zoom-out').onclick=()=>svg.transition().duration(reduceMotion?0:250).call(zoom.scaleBy,1/1.65);
$('labels-toggle').onchange=updateOverlays;$('grid-toggle').onchange=updateOverlays;
$('map').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();keyboard||=[width/2,height/2];const step=event.shiftKey?4:18;const delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key];keyboard=[Math.max(15,Math.min(width-15,keyboard[0]+delta[0])),Math.max(70,Math.min(height-65,keyboard[1]+delta[1]))];$('keyboard-cursor').hidden=false;updateOverlays();}if(event.key==='Enter'&&keyboard){event.preventDefault();submitPoint(keyboard);}if(event.key==='+'||event.key==='=')$('zoom-in').click();if(event.key==='-')$('zoom-out').click();if(event.key==='Escape')home();});
document.addEventListener('keydown',event=>{if(event.key==='/'&&mode==='atlas'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)&&!$('sources-dialog').open){event.preventDefault();$('search').focus();}});
for(const id of ['sources-open','sources-footer'])$(id).onclick=()=>$('sources-dialog').showModal();$('sources-close').onclick=()=>$('sources-dialog').close();$('sources-dialog').addEventListener('click',event=>{if(event.target===$('sources-dialog')){const b=event.target.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)event.target.close();}});
let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderMap,120);}).observe($('map'));
renderFilters();renderResults();renderDetail();updateCounters();save();renderMap();
})();
