// app.js - 리팩토링된 엑셀 피벗 대시보드 (차트 렌더 수정, 다크/설정저장 제거)
let workbook, currentSheetName, jsonData, aggregatedData;

const state = {
  data: null,
  fields: [],
  selected: { x: [], y: [] },
  chart: { type: 'scatter', agg: 'none', title: '차트' }
};

// DOM 엘리먼트
const el = id => document.getElementById(id);
const fileInput = el('file');
const sheetSelect = el('sheetSelect');
const fieldList = el('fieldList');
const xSelect = el('xSelect');
const ySelect = el('ySelect');
const aggSelect = el('aggSelect');
const chartTypeEl = el('chartType');
const renderBtn = el('renderBtn');
const downloadImage = el('downloadImage');
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
const tabData = el('tab-data');
const tabChart = el('tab-chart');
const panelData = el('panel-data');
const panelChart = el('panel-chart');

// 탭 전환
function setTab(tab){
  if(tab === 'data'){
    panelData.classList.remove('hidden');
    panelChart.classList.add('hidden');
    tabData.classList.add('bg-indigo-50');
    tabChart.classList.remove('bg-indigo-50');
  } else {
    panelData.classList.add('hidden');
    panelChart.classList.remove('hidden');
    tabChart.classList.add('bg-indigo-50');
    tabData.classList.remove('bg-indigo-50');
  }
}

tabData.addEventListener('click', () => setTab('data'));
tabChart.addEventListener('click', () => setTab('chart'));

// 엑셀 파일 읽기
function readFile(file){
  const reader = new FileReader();
  reader.onload = function(e){
    try {
      const data = new Uint8Array(e.target.result);
      workbook = XLSX.read(data, {type:'array'});
      populateSheets();
    } catch (err) {
      alert('파일 읽기 실패: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function populateSheets(){
  sheetSelect.innerHTML = '';
  workbook.SheetNames.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sheetSelect.appendChild(opt);
  });
  sheetSelect.value = workbook.SheetNames[0];
  sheetSelect.dispatchEvent(new Event('change'));
}

sheetSelect.addEventListener('change', function(){
  currentSheetName = sheetSelect.value || workbook.SheetNames[0];
  const sheet = workbook.Sheets[currentSheetName];
  jsonData = XLSX.utils.sheet_to_json(sheet, {defval: null});
  state.data = jsonData;
  populateFields();
});

function populateFields(){
  fieldList.innerHTML = '';
  xSelect.innerHTML = '';
  ySelect.innerHTML = '';
  
  if(!jsonData || jsonData.length === 0) return;
  
  const keys = Object.keys(jsonData[0]);
  state.fields = keys;
  
  keys.forEach(k => {
    // fieldList 추가
    const d = document.createElement('div');
    d.textContent = k;
    d.className = 'text-sm p-1 border-b';
    fieldList.appendChild(d);
    
    // select 옵션 추가
    const ox = document.createElement('option');
    ox.value = k;
    ox.textContent = k;
    xSelect.appendChild(ox);
    
    const oy = document.createElement('option');
    oy.value = k;
    oy.textContent = k;
    ySelect.appendChild(oy);
  });
}

fileInput.addEventListener('change', (ev) => {
  const f = ev.target.files[0];
  if(f) readFile(f);
});

// 최대 2개 제한
function limitSelection(selectEl, max){
  const selected = Array.from(selectEl.selectedOptions).map(o => o.value);
  if(selected.length > max){
    for(let i = 0; i < selectEl.options.length; i++){
      const opt = selectEl.options[i];
      if(selected.indexOf(opt.value) >= max){
        opt.selected = false;
      }
    }
  }
}

xSelect.addEventListener('change', () => limitSelection(xSelect, 2));
ySelect.addEventListener('change', () => limitSelection(ySelect, 2));

// 데이터 집계
function aggregate(data, xKeys, yKeys, agg){
  if(!xKeys.length) return data;
  if(agg === 'none') return data;
  
  const map = new Map();
  data.forEach(row => {
    const key = xKeys.map(k => String(row[k])).join('||');
    if(!map.has(key)){
      map.set(key, {keys: xKeys.map(k => row[k]), count: 0, sums: {}});
    }
    const e = map.get(key);
    e.count += 1;
    yKeys.forEach(yk => {
      const v = parseFloat(row[yk]);
      if(!isNaN(v)){
        e.sums[yk] = (e.sums[yk] || 0) + v;
      }
    });
  });
  
  const out = [];
  for(const [k, v] of map.entries()){
    const row = {};
    xKeys.forEach((xx, i) => row[xx] = v.keys[i]);
    yKeys.forEach(yk => {
      if(agg === 'count'){
        row[yk] = v.count;
      } else if(agg === 'mean'){
        row[yk] = (v.sums[yk] || 0) / v.count;
      } else {
        row[yk] = v.sums[yk] || 0;
      }
    });
    out.push(row);
  }
  
  return out;
}

// 트레이스 생성
function buildTraces(data, xKeys, yKeys, chartType){
  const traces = [];
  const x = data.map((r, i) => i);
  const color1 = seriesColor.value || '#1f77b4';
  const size = parseInt(markerSize.value) || 8;
  const symbol = markerSymbol.value || 'circle';
  
  if(yKeys[0]){
    const trace = {
      x: x,
      y: data.map(r => r[yKeys[0]]),
      name: yKeys[0],
      marker: { color: color1, size: size, symbol: symbol }
    };
    
    if(chartType === 'scatter'){
      trace.type = 'scatter';
      trace.mode = 'markers';
    } else if(chartType === 'line'){
      trace.type = 'scatter';
      trace.mode = 'lines+markers';
    } else if(chartType === 'bar'){
      trace.type = 'bar';
    } else if(chartType === 'area'){
      trace.type = 'scatter';
      trace.mode = 'lines';
      trace.fill = 'tozeroy';
    }
    
    traces.push(trace);
  }
  
  if(yKeys[1]){
    const trace2 = {
      x: x,
      y: data.map(r => r[yKeys[1]]),
      name: yKeys[1],
      yaxis: 'y2',
      marker: { size: size }
    };
    
    if(chartType === 'scatter'){
      trace2.type = 'scatter';
      trace2.mode = 'markers';
    } else if(chartType === 'line'){
      trace2.type = 'scatter';
      trace2.mode = 'lines+markers';
    } else if(chartType === 'bar'){
      trace2.type = 'bar';
    } else if(chartType === 'area'){
      trace2.type = 'scatter';
      trace2.mode = 'lines';
      trace2.fill = 'tozeroy';
    }
    
    traces.push(trace2);
  }
  
  return traces;
}

// 차트 렌더링
function renderPlot(targetEl){
  const xKeys = Array.from(xSelect.selectedOptions).map(o => o.value);
  const yKeys = Array.from(ySelect.selectedOptions).map(o => o.value);
  
  if(!state.data || yKeys.length === 0){
    targetEl.innerHTML = '<div class="p-4 text-sm text-gray-500">데이터와 Y축 필드를 선택하세요.</div>';
    return;
  }
  
  const agg = aggSelect.value;
  const chartType = chartTypeEl.value;
  state.chart.type = chartType;
  state.chart.agg = agg;
  
  const data = agg === 'none' ? state.data : aggregate(state.data, xKeys, yKeys, agg);
  aggregatedData = data;
  
  const traces = buildTraces(data, xKeys, yKeys, chartType);
  
  const xLabels = xKeys[0] ? data.map(r => String(r[xKeys[0]])) : data.map((_, i) => String(i));
  
  const layout = {
    title: '차트',
    xaxis: {
      title: xTitle.value || xKeys[0] || '',
      tickangle: -45,
      tickvals: data.map((_, i) => i),
      ticktext: xLabels,
      gridcolor: gridColor.value
    },
    yaxis: {
      title: yTitle.value || yKeys[0] || '',
      type: yLog.checked ? 'log' : 'linear',
      gridcolor: gridColor.value
    },
    margin: { t: 60, b: 140, l: 80, r: 80 },
    showlegend: true,
    legend: {
      orientation: legendPos.value === 'top' || legendPos.value === 'bottom' ? 'h' : 'v',
      x: legendPos.value === 'right' ? 1 : (legendPos.value === 'left' ? 0 : 0.5),
      y: legendPos.value === 'top' ? 1 : (legendPos.value === 'bottom' ? 0 : 0.5),
      xanchor: 'center',
      yanchor: 'middle'
    },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#f9fafb',
    font: {
      family: 'Malgun Gothic, 맑은 고딕, Arial',
      color: '#111827',
      size: 12
    }
  };
  
  if(yKeys[1]){
    layout.yaxis2 = {
      overlaying: 'y',
      side: 'right',
      title: yKeys[1],
      gridcolor: gridColor.value
    };
  }
  
  try {
    Plotly.newPlot(targetEl, traces, layout, {responsive: true});
  } catch (err) {
    console.error('Plotly 렌더링 실패:', err);
    targetEl.innerHTML = '<div class="p-4 text-red-500">차트 렌더링 실패: ' + err.message + '</div>';
  }
}

function renderChart(){
  renderPlot(plotEl);
  renderPlot(plot2El);
}

renderBtn.addEventListener('click', () => {
  renderChart();
  setTab('chart');
});

// 고해상도 다운로드
downloadImage.addEventListener('click', () => {
  if(!aggregatedData){
    alert('먼저 차트를 렌더링하세요.');
    return;
  }
  
  Plotly.toImage(plotEl, {format: 'png', width: 2480, height: 3508, scale: 2})
    .then(url => {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chart_highres.png';
      a.click();
    })
    .catch(err => {
      alert('이미지 저장 실패: ' + err.message);
    });
});
