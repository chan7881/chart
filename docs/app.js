// app.js - Tailwind + Plotly advanced dashboard
let workbook, currentSheetName, jsonData, aggregatedData;

const state = {
  data: null,
  fields: [],
  selected: { x: [], y: [] },
  chart: { type: 'scatter', agg: 'none', title: 'Pivot Chart' },
  style: {
    axis: { xTitle: '', yTitle: '', yLog: false },
    grid: { color: '#cccccc' },
    legend: { position: 'top' },
    series: { color: '#1f77b4', marker: 'circle', size: 8 },
    dark: false
  }
};

// Elements
const el = id => document.getElementById(id);
const fileInput = el('file');
const sheetSelect = el('sheetSelect');
const fieldList = el('fieldList');
const xSelect = el('xSelect');
const ySelect = el('ySelect');
const aggSelect = el('aggSelect');
const renderBtn = el('renderBtn');
const titleInput = el('titleInput');
const chartType = el('chartType');
const downloadImage = el('downloadImage');
const darkToggle = el('darkToggle');
const exportJson = el('exportJson');
const importJsonBtn = el('importJsonBtn');
const saveConfig = el('saveConfig');
const loadConfig = el('loadConfig');
const xTitle = el('xTitle');
const yTitle = el('yTitle');
const yLog = el('yLog');
const gridColor = el('gridColor');
const legendPos = el('legendPos');
const seriesColor = el('seriesColor');
const markerSymbol = el('markerSymbol');
const markerSize = el('markerSize');
const plotEl = el('plot');
const plot2El = el('plot2');

// Tabs
const tabData = el('tab-data');
const tabChart = el('tab-chart');
const panelData = el('panel-data');
const panelChart = el('panel-chart');

function setTab(tab){
  if(tab==='data'){
    panelData.classList.remove('hidden'); panelChart.classList.add('hidden');
    tabData.classList.add('bg-indigo-50'); tabChart.classList.remove('bg-indigo-50');
  } else {
    panelData.classList.add('hidden'); panelChart.classList.remove('hidden');
    tabChart.classList.add('bg-indigo-50'); tabData.classList.remove('bg-indigo-50');
  }
}

tabData.addEventListener('click', ()=> setTab('data'));
tabChart.addEventListener('click', ()=> setTab('chart'));

// Dark mode
darkToggle.addEventListener('change', ()=>{
  state.style.dark = darkToggle.checked;
  document.documentElement.classList.toggle('dark', state.style.dark);
  renderChart();
});

function readFile(file){
  const reader = new FileReader();
  reader.onload = function(e){
    const data = new Uint8Array(e.target.result);
    workbook = XLSX.read(data, {type:'array'});
    populateSheets();
  };
  reader.readAsArrayBuffer(file);
}

function populateSheets(){
  sheetSelect.innerHTML = '';
  workbook.SheetNames.forEach(name => {
    const opt = document.createElement('option'); opt.value = name; opt.textContent = name; sheetSelect.appendChild(opt);
  });
  sheetSelect.onchange();
}

sheetSelect.onchange = function(){
  currentSheetName = sheetSelect.value || workbook.SheetNames[0];
  const sheet = workbook.Sheets[currentSheetName];
  jsonData = XLSX.utils.sheet_to_json(sheet, {defval: null});
  state.data = jsonData;
  populateFields();
};

function populateFields(){
  fieldList.innerHTML = '';
  xSelect.innerHTML = '';
  ySelect.innerHTML = '';
  if(!jsonData || jsonData.length===0) return;
  const keys = Object.keys(jsonData[0]);
  state.fields = keys;
  keys.forEach(k => {
    const d = document.createElement('div'); d.textContent = k; d.className='text-sm p-1'; fieldList.appendChild(d);
    const ox = document.createElement('option'); ox.value=k; ox.textContent=k; xSelect.appendChild(ox);
    const oy = document.createElement('option'); oy.value=k; oy.textContent=k; ySelect.appendChild(oy);
  });
}

fileInput.addEventListener('change', (ev) => { const f = ev.target.files[0]; if(f) readFile(f); });

function limitSelection(selectEl, max){
  const selected = Array.from(selectEl.selectedOptions).map(o=>o.value);
  if(selected.length > max){
    for(let i=0;i<selectEl.options.length;i++){ const opt = selectEl.options[i]; if(selected.indexOf(opt.value) >= max){ opt.selected = false; } }
  }
}

xSelect.addEventListener('change', ()=> limitSelection(xSelect,2));
ySelect.addEventListener('change', ()=> limitSelection(ySelect,2));

function aggregate(data, xKeys, yKeys, agg){
  if(!xKeys.length) return data;
  if(agg==='none') return data.map(r=>r);
  const map = new Map();
  data.forEach(row=>{
    const key = xKeys.map(k=>String(row[k])).join('||');
    if(!map.has(key)) map.set(key, {keys: xKeys.map(k=>row[k]), count:0, sums:{}});
    const e = map.get(key); e.count+=1; yKeys.forEach(yk=>{ const v=parseFloat(row[yk]); if(!isNaN(v)) e.sums[yk]=(e.sums[yk]||0)+v; });
  });
  const out=[];
  for(const [k,v] of map.entries()){
    const row={}; xKeys.forEach((xx,i)=>row[xx]=v.keys[i]);
    yKeys.forEach(yk=>{ if(agg==='count') row[yk]=v.count; else if(agg==='mean') row[yk]=(v.sums[yk]||0)/v.count; else row[yk]=v.sums[yk]||0; });
    out.push(row);
  }
  return out;
}

function buildTraces(data, xKeys, yKeys){
  const traces=[];
  const x = data.map((r,i)=>i);
  if(yKeys[0]){
    traces.push({ x, y: data.map(r=>r[yKeys[0]]), type: state.chart.type==='bar'?'bar':'scatter', mode: state.chart.type==='line'?'lines':'lines+markers', name:yKeys[0], marker:{color: state.style.series.color, size: parseInt(markerSize.value), symbol: markerSymbol.value} });
  }
  if(yKeys[1]){
    traces.push({ x, y: data.map(r=>r[yKeys[1]]), type: state.chart.type==='bar'?'bar':'scatter', mode: state.chart.type==='line'?'lines':'lines+markers', name:yKeys[1], yaxis:'y2', marker:{size: parseInt(markerSize.value)} });
  }
  return traces;
}

function renderPlot(targetEl){
  const xKeys = Array.from(xSelect.selectedOptions).map(o=>o.value);
  const yKeys = Array.from(ySelect.selectedOptions).map(o=>o.value);
  if(!state.data || yKeys.length===0){ targetEl.innerHTML = '<div class="p-4 text-sm">데이터와 Y축 필드를 선택하세요.</div>'; return; }
  const agg = aggSelect.value; state.chart.type = chartType.value; state.chart.agg = agg; state.chart.title = titleInput.value||'Pivot Chart';
  const data = aggregate(state.data, xKeys, yKeys, agg);
  aggregatedData = data;
  const traces = buildTraces(data, xKeys, yKeys);
  const dark = state.style.dark;
  const layout = {
    title: state.chart.title,
    paper_bgcolor: dark? '#0f172a': '#ffffff',
    plot_bgcolor: dark? '#020617':'#ffffff',
    xaxis: { title: xTitle.value||xKeys[0]||'', tickangle:-45, tickvals: data.map((_,i)=>i), ticktext: xKeys[0]? data.map(r=>String(r[xKeys[0]])): data.map((_,i)=>String(i)), gridcolor: gridColor.value},
    yaxis: { title: yTitle.value||yKeys[0]||'', type: yLog.checked? 'log':'linear', gridcolor: gridColor.value},
    margin: { t:60, b:140 },
    showlegend: true,
    legend: { orientation: legendPos.value==='top'?'h':'v', x: legendPos.value==='right'?1:0.5, xanchor: 'center' },
    font: { family: 'Malgun Gothic', color: dark? '#ffffff': '#000000', size: 12 }
  };
  if(yKeys[1]) layout.yaxis2 = { overlaying:'y', side:'right', title: yKeys[1] };
  Plotly.react(targetEl, traces, layout, {responsive:true});
}

function renderChart(){ renderPlot(plotEl); renderPlot(plot2El); }

renderBtn.addEventListener('click', ()=>{ renderChart(); setTab('chart'); });

// Export/Import JSON
exportJson.addEventListener('click', ()=>{
  const cfg = { state, fields: state.fields };
  const blob = new Blob([JSON.stringify(cfg,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='style_config.json'; a.click(); URL.revokeObjectURL(url);
});

loadConfig.addEventListener('change', (e)=>{
  const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = ev=>{ try{ const cfg=JSON.parse(ev.target.result); applyConfig(cfg); alert('설정 적용 완료'); }catch(err){ alert('JSON 파싱 실패'); } }; r.readAsText(f);
});

function applyConfig(cfg){
  if(cfg && cfg.state){ Object.assign(state, cfg.state); }
  // apply some UI fields
  titleInput.value = state.chart.title || '';
  chartType.value = state.chart.type || 'scatter';
  seriesColor.value = state.style.series.color || '#1f77b4';
  markerSize.value = state.style.series.size || 8;
  darkToggle.checked = !!state.style.dark; document.documentElement.classList.toggle('dark', state.style.dark);
  renderChart();
}

// High resolution export
downloadImage.addEventListener('click', ()=>{
  const target = plotEl;
  Plotly.toImage(target, {format:'png', width: 2480, height: 3508, scale: 2}).then(url=>{
    const a=document.createElement('a'); a.href=url; a.download='chart_highres.png'; a.click();
  }).catch(err=>alert('이미지 저장 실패'));
});

// initial load config if exists
fetch('style_config.json').then(r=>r.json()).then(cfg=>{ if(cfg){ if(cfg.title) titleInput.value=cfg.title; if(cfg.font_size){} }}).catch(()=>{});
