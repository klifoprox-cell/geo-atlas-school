const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('./core.js'),d3=require('./d3.min.js');
const context={window:{}};vm.runInNewContext(fs.readFileSync('atlas-data.js','utf8'),context);
const data=context.window.ATLAS_DATA,objects=data.objects;
assert.equal(objects.length,58);assert.equal(new Set(objects.map(o=>o.id)).size,58);
assert.equal(objects.filter(o=>o.kind==='continent').length,6);assert.equal(objects.filter(o=>o.kind==='ocean').length,5);
const queries=[['Карское','kara'],['Саргассово','sargasso'],['черное море','black'],['азовкское','azov'],['желтое','yellow'],['белое','white'],['красное','red'],['баренцево','barents'],['балтика','baltic'],['филиппины','philippines'],['марианыские остарова','marianas'],['канарские','canaries'],['мадагаскар','madagascar'],['баффинова зелмя','baffin'],['самали','somali'],['индостан','hindustan'],['индокитай','indochina'],['аравийский','arabia'],['скандинавский','scandinavia'],['о. сахалин','sakhalin'],['чукоткский п.ов','chukchi'],['гибралтарский','gibraltar'],['петра великого','peter-great'],['гвинейский','guinea'],['новая гвинея','new-guinea'],['мексиканский','mexico'],['карбиское','caribbean'],['лабрадор','labrador'],['лабрадор','labrador-sea'],['магелланов','magellan'],['дрейка','drake'],['тасмания','tasmania'],['японские','japan'],['аденский','aden'],['крымский п-ов','crimea'],['п-ов таймыр','taymyr'],['берингов','bering'],['бискайский','biscay'],['о. Великобритания','great-britain'],['финский','finland'],['мраморное','marmara']];
for(const [q,id] of queries)assert(core.search(objects,q).some(o=>o.id===id),`Query ${q} must find ${id}`);
assert.equal(core.search(objects,'лабрадор').length,2);
assert.equal(core.search(objects,'совсем неизвестное место').length,0);
assert(core.search(objects,'','sea').every(o=>o.kind==='sea'));
for(const o of objects){assert(/[А-Яа-яЁё]/.test(o.name));assert(o.fact&&o.hint&&o.where);assert(o.source.url||data.sources.some(s=>s.dataset===o.source.dataset));assert(o.point.every(Number.isFinite));const p=d3.geoEqualEarth().rotate([-o.point[0],0]).fitExtent([[15,70],[685,580]],{type:'Sphere'});const output=d3.geoPath(p)(o.geometry);assert(output&&!output.includes('NaN'),`Bad geometry: ${o.name}`);if(!o.pointOnly&&o.kind!=='river')assert(d3.geoContains(o.geometry,o.point),`Label outside source region: ${o.name}`);}
const africa=objects.find(o=>o.id==='africa');assert(d3.geoContains(africa.geometry,[20,0]));assert(!d3.geoContains(africa.geometry,[-100,40]));
const nile=objects.find(o=>o.id==='nile');const point=d3.geoEqualEarth();const geom=nile.geometry.type==='GeometryCollection'?nile.geometry.geometries[0]:nile.geometry;const start=geom.type==='MultiLineString'?geom.coordinates[0][0]:geom.coordinates[0];assert(core.lineDistance(nile.geometry,point,point(start))<.01);
assert.equal(core.shuffled(objects,()=>.5).length,58);
for(const f of ['app.js','core.js'])new vm.Script(fs.readFileSync(f,'utf8'));
console.log(`PASS: ${objects.length} objects, ${queries.length} requested searches, Russian labels, source links, map projection, continent hit checks, river hit checks, syntax.`);


