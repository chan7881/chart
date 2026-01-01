// app.js - Static pivot visualizer using SheetJS + Plotly
let workbook, currentSheetName, jsonData, aggregatedData;

const fileInput = document.getElementById('file');
const sheetSelect = document.getElementById('sheetSelect');
const fieldList = document.getElementById('fieldList');
const xSelect = document.getElementById('xSelect');
const ySelect = document.getElementById('ySelect');
const aggSelect = document.getElementById('aggSelect');
const renderBtn = document.getElementById('renderBtn');
const downloadBtn = document.getElementById('downloadBtn');
const titleInput = document.getElementById('titleInput');
const themeSelect = document.getElementById('themeSelect');
const fontInput = document.getElementById('fontInput');
const gridInput = document.getElementById('gridInput');

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
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name; sheetSelect.appendChild(opt);
  });
  sheetSelect.onchange();
}

sheetSelect.onchange = function(){
  currentSheetName = sheetSelect.value || workbook.SheetNames[0];
  const sheet = workbook.Sheets[currentSheetName];
  jsonData = XLSX.utils.sheet_to_json(sheet, {defval: null});
  populateFields();
};

function populateFields(){
  fieldList.innerHTML = '';
  xSelect.innerHTML = '';
  ySelect.innerHTML = '';
  if(!jsonData || jsonData.length===0) return;
  const keys = Object.keys(jsonData[0]);
  keys.forEach(k => {
    const el = document.createElement('div'); el.textContent = k; fieldList.appendChild(el);
    const ox = document.createElement('option'); ox.value=k; ox.textContent=k; xSelect.appendChild(ox);
    const oy = document.createElement('option'); oy.value=k; oy.textContent=k; ySelect.appendChild(oy);
  });
}

fileInput.addEventListener('change', (ev) => {
  const f = ev.target.files[0]; if(f) readFile(f);
});

function limitSelection(selectEl, max){
  const selected = Array.from(selectEl.selectedOptions).map(o=>o.value);
  if(selected.length > max){
    // deselect extras
    for(let i=0;i<selectEl.options.length;i++){
      const opt = selectEl.options[i];
      if(selected.indexOf(opt.value) >= max){ opt.selected = false; }
    }
  }
}

xSelect.addEventListener('change', ()=> limitSelection(xSelect,2));
ySelect.addEventListener('change', ()=> limitSelection(ySelect,2));

function groupAndAggregate(data, xKeys, yKeys, agg){
  if(!xKeys.length || !yKeys.length || agg==='none') return data;
  const map = new Map();
  data.forEach(row => {
    const key = xKeys.map(k => String(row[k])).join('||');
    if(!map.has(key)) map.set(key, {__count:0, __keyvals: xKeys.map(k=>row[k])});
    const entry = map.get(key);
    entry.__count += 1;
    yKeys.forEach(yk => {
      const v = parseFloat(row[yk]);
      if(!isNaN(v)) entry[yk] = (entry[yk]||0) + v;
    });
  });
  const out = [];
  for(const [k,val] of map.entries()){
    const outRow = {};
    xKeys.forEach((xx,i)=> outRow[xx]=val.__keyvals[i]);
    yKeys.forEach(yk => {
      if(agg==='count') outRow[yk]=val.__count;
      else if(agg==='mean') outRow[yk] = (val[yk]||0)/val.__count;
      else outRow[yk] = val[yk]||0;
    });
    out.push(outRow);
  }
  return out;
}

function toCSV(arr){
  if(!arr || arr.length===0) return '';
  const keys = Object.keys(arr[0]);
  const lines = [keys.join(',')];
  arr.forEach(r => {
    lines.push(keys.map(k=> JSON.stringify(r[k]===null||r[k]===undefined? '': r[k])).join(','));
  });
  return lines.join('\n');
}

renderBtn.addEventListener('click', ()=>{
  const xKeys = Array.from(xSelect.selectedOptions).map(o=>o.value);
  const yKeys = Array.from(ySelect.selectedOptions).map(o=>o.value);
  if(yKeys.length===0){ alert('Select at least one Y-axis field'); return; }
  const agg = aggSelect.value;
  const data = jsonData.slice();
  aggregatedData = groupAndAggregate(data, xKeys, yKeys, agg);

  // build x position array
  const positions = aggregatedData.map((_,i)=>i);
  const x0Labels = xKeys[0] ? aggregatedData.map(r=>String(r[xKeys[0]])) : positions.map(String);
  const x1Labels = xKeys[1] ? aggregatedData.map(r=>String(r[xKeys[1]])) : null;

  const traces = [];
  // primary Y
  traces.push({ x: positions, y: aggregatedData.map(r=> r[yKeys[0]]), type:'scatter', mode:'lines+markers', name: yKeys[0], marker:{symbol:'circle'} });
  // secondary Y
  if(yKeys[1]){
    traces.push({ x: positions, y: aggregatedData.map(r=> r[yKeys[1]]), type:'scatter', mode:'lines+markers', name: yKeys[1], yaxis:'y2', marker:{symbol:'x'} });
  }

  const layout = {
    title: titleInput.value || 'Pivot Chart',
    xaxis: { tickmode:'array', tickvals: positions, ticktext: x0Labels, tickangle: -45 },
    yaxis: { title: yKeys[0] },
    margin: { t:50, b:120 },
    showlegend:true,
    font: { family: 'Malgun Gothic', size: parseInt(fontInput.value) || 12 }
  };

  if(x1Labels){
    layout.xaxis2 = { tickmode:'array', tickvals: positions, ticktext: x1Labels, side: 'top', overlaying:'x' };
  }
  if(yKeys[1]){
    layout.yaxis2 = { title: yKeys[1], overlaying: 'y', side: 'right' };
  }

  if(gridInput.checked){ layout.xaxis.showgrid = true; layout.yaxis.showgrid = true; }

  Plotly.newPlot('plot', traces, layout, {responsive:true});
});

downloadBtn.addEventListener('click', ()=>{
  if(!aggregatedData) { alert('Render chart first'); return; }
  const csv = toCSV(aggregatedData);
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'aggregated.csv'; a.click(); URL.revokeObjectURL(url);
});

// Load default style config if exists next to site
fetch('style_config.json').then(r=>r.json()).then(cfg=>{
  titleInput.value = cfg.title || '';
  fontInput.value = cfg.font_size || 12;
  gridInput.checked = !!cfg.grid;
}).catch(()=>{});
