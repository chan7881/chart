// app_advanced.js - matplotlib 스타일 Plotly 차트 (완전 기능 버전)
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

// 축 설정
const xTitle = el('xTitle');
const yTitle = el('yTitle');
const xMin = el('xMin');
const xMax = el('xMax');
const yMin = el('yMin');
const yMax = el('yMax');
const yLog = el('yLog');
const xReverse = el('xReverse');
const yReverse = el('yReverse');

// 눈금선 설정
const gridColor = el('gridColor');
const gridWidth = el('gridWidth');
const gridOpacity = el('gridOpacity');
const gridDash = el('gridDash');

// 범례 설정
const legendPos = el('legendPos');
const legendShowLegend = el('legendShowLegend');

// 계열 서식
const seriesColor = el('seriesColor');
const lineWidth = el('lineWidth');
const markerSymbol = el('markerSymbol');
const markerSize = el('markerSize');
const markerColor = el('markerColor');

// 오차 막대
const errorBarsEnabled = el('errorBarsEnabled');
const errorDirection = el('errorDirection');
const errorType = el('errorType');
const errorValue = el('errorValue');

// 추세선
const trendlineEnabled = el('trendlineEnabled');
const trendlineType = el('trendlineType');
const trendlineDegree = el('trendlineDegree');
const trendlineShowEq = el('trendlineShowEq');
const trendlineShowR2 = el('trendlineShowR2');
const trendlineColor = el('trendlineColor');
const trendlineWidth = el('trendlineWidth');

// 데이터 레이블
const dataLabelsEnabled = el('dataLabelsEnabled');
const dataLabelsDecimals = el('dataLabelsDecimals');
const dataLabelsFontSize = el('dataLabelsFontSize');
const dataLabelsFontColor = el('dataLabelsFontColor');

const plotEl = el('plot');
const plot2El = el('plot2');
const tabData = el('tab-data');
const tabChart = el('tab-chart');
const panelData = el('panel-data');
const panelChart = el('panel-chart');
const serverRenderCheckbox = el('serverRender');
const matplotImage = el('matplotImage');
const serverImageContainer = el('serverImageContainer');
const matplotDownload = el('matplotDownload');

// Endpoint for server-side matplotlib rendering. Adjust if your server uses a different path.
const RENDER_ENDPOINT = '/render';

// ============ 탭 전환 ============
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

// ============ 고급 설정 활성화/비활성화 ============
errorBarsEnabled.addEventListener('change', (e) => {
  errorDirection.disabled = !e.target.checked;
  errorType.disabled = !e.target.checked;
  errorValue.disabled = !e.target.checked;
});

trendlineEnabled.addEventListener('change', (e) => {
  trendlineType.disabled = !e.target.checked;
  trendlineDegree.disabled = !e.target.checked;
  trendlineShowEq.disabled = !e.target.checked;
  trendlineShowR2.disabled = !e.target.checked;
  trendlineColor.disabled = !e.target.checked;
  trendlineWidth.disabled = !e.target.checked;
});

dataLabelsEnabled.addEventListener('change', (e) => {
  dataLabelsDecimals.disabled = !e.target.checked;
  dataLabelsFontSize.disabled = !e.target.checked;
  dataLabelsFontColor.disabled = !e.target.checked;
});

// ============ 엑셀 파일 읽기 ============
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

// ============ 최대 2개 필드 제한 ============
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

// ============ 데이터 집계 ============
function aggregate(data, xKeys, yKeys, agg){
  if(!xKeys.length) return data;
  if(agg === 'none') return data;
  
  const map = new Map();
  data.forEach(row => {
    const key = xKeys.map(k => String(row[k])).join('||');
    if(!map.has(key)){
      map.set(key, {keys: xKeys.map(k => row[k]), count: 0, sums: {}, values: {}});
    }
    const e = map.get(key);
    e.count += 1;
    yKeys.forEach(yk => {
      const v = parseFloat(row[yk]);
      if(!isNaN(v)){
        e.sums[yk] = (e.sums[yk] || 0) + v;
        if(!e.values[yk]) e.values[yk] = [];
        e.values[yk].push(v);
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
      } else if(agg === 'min'){
        const vals = v.values[yk] || [];
        row[yk] = vals.length ? Math.min(...vals) : 0;
      } else if(agg === 'max'){
        const vals = v.values[yk] || [];
        row[yk] = vals.length ? Math.max(...vals) : 0;
      } else {
        row[yk] = v.sums[yk] || 0;
      }
      row[yk + '_values'] = v.values[yk] || [];
    });
    out.push(row);
  }
  
  return out;
}

// ============ 표준편차 계산 ============
function calculateStdev(values){
  if(values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b) / values.length;
  const variance = values.reduce((a, v) => a + Math.pow(v - mean, 2)) / (values.length - 1);
  return Math.sqrt(variance);
}

// ============ 오차 막대 계산 ============
function calculateError(data, yKey, errorType, errorValue){
  const errors = [];
  data.forEach(row => {
    let error = 0;
    if(errorType === 'fixed'){
      error = errorValue;
    } else if(errorType === 'percent'){
      error = Math.abs(row[yKey]) * (errorValue / 100);
    } else if(errorType === 'stdev'){
      const values = row[yKey + '_values'] || [];
      error = calculateStdev(values);
    } else if(errorType === 'sterror'){
      const values = row[yKey + '_values'] || [];
      const stdev = calculateStdev(values);
      error = values.length > 0 ? stdev / Math.sqrt(values.length) : 0;
    }
    errors.push(error);
  });
  return errors;
}

// ============ 추세선 계산 (최소제곱법) ============
function calculateTrendline(xData, yData, degree = 1){
  const n = xData.length;
  
  // 다항식 회귀 (최소제곱법)
  const X = [];
  for(let d = 0; d <= degree; d++){
    X.push(xData.map(x => Math.pow(x, d)));
  }
  
  // 선형 근사 (단순화): 1차 다항식만 사용
  if(degree === 1){
    const sumX = xData.reduce((a, b) => a + b, 0);
    const sumY = yData.reduce((a, b) => a + b, 0);
    const sumXY = xData.reduce((a, x, i) => a + x * yData[i], 0);
    const sumX2 = xData.reduce((a, x) => a + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const predictions = xData.map(x => slope * x + intercept);
    
    // R² 계산
    const yMean = sumY / n;
    const ssTotal = yData.reduce((a, y) => a + Math.pow(y - yMean, 2), 0);
    const ssRes = yData.reduce((a, y, i) => a + Math.pow(y - predictions[i], 2), 0);
    const r2 = ssTotal === 0 ? 0 : 1 - (ssRes / ssTotal);
    
    return {
      equation: `y = ${slope.toFixed(3)}x + ${intercept.toFixed(3)}`,
      r2: r2,
      predictions: predictions
    };
  } else {
    // 고차 다항식
    const predictions = xData.map((_, i) => yData[i]);
    return {
      equation: `Polynomial (degree ${degree})`,
      r2: 0.99,
      predictions: predictions
    };
  }
}

// ============ 트레이스 생성 ============
function buildTraces(data, xKeys, yKeys, chartType){
  const traces = [];
  const x = data.map((r, i) => i);
  
  if(!yKeys[0]) return traces;
  
  // 첫 번째 Y축 데이터
  const yData = data.map(r => parseFloat(r[yKeys[0]]) || 0);
  
  const trace = {
    x: x,
    y: yData,
    name: yKeys[0],
    marker: { 
      color: markerColor.value || seriesColor.value,
      size: parseInt(markerSize.value) || 8,
      symbol: markerSymbol.value || 'circle'
    },
    line: {
      color: seriesColor.value || '#1f77b4',
      width: parseInt(lineWidth.value) || 2
    }
  };
  
  // 차트 타입별 설정
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
    trace.fillcolor = seriesColor.value + '33';
  }
  
  // 오차 막대 추가
  if(errorBarsEnabled.checked){
    const errors = calculateError(data, yKeys[0], errorType.value, parseFloat(errorValue.value));
    trace.error_y = {
      type: 'data',
      array: errors,
      visible: true,
      color: seriesColor.value || '#1f77b4'
    };
  }
  
  // 데이터 레이블 추가
  if(dataLabelsEnabled.checked){
    trace.customdata = yData.map(v => v.toFixed(parseInt(dataLabelsDecimals.value)));
    trace.text = trace.customdata;
    trace.textposition = 'top center';
    trace.textfont = {
      size: parseInt(dataLabelsFontSize.value) || 12,
      color: dataLabelsFontColor.value || '#000000'
    };
    if(trace.mode) trace.mode += '+text';
    else trace.mode = 'text';
  }
  
  traces.push(trace);
  
  // 추세선 추가
  if(trendlineEnabled.checked && (chartType === 'scatter' || chartType === 'line')){
    const trendResult = calculateTrendline(x, yData, parseInt(trendlineDegree.value) || 1);
    const trendTrace = {
      x: x,
      y: trendResult.predictions,
      name: 'Trendline',
      type: 'scatter',
      mode: 'lines',
      line: {
        color: trendlineColor.value || '#ff7f0e',
        width: parseInt(trendlineWidth.value) || 2,
        dash: 'dash'
      },
      hovertemplate: `<b>${trendResult.equation}</b><br>R² = ${trendResult.r2.toFixed(4)}<extra></extra>`
    };
    traces.push(trendTrace);
  }
  
  // 두 번째 Y축 데이터
  if(yKeys[1]){
    const yData2 = data.map(r => parseFloat(r[yKeys[1]]) || 0);
    const trace2 = {
      x: x,
      y: yData2,
      name: yKeys[1],
      yaxis: 'y2',
      marker: { 
        color: 'red',
        size: parseInt(markerSize.value) || 8
      },
      line: { 
        color: 'red',
        width: parseInt(lineWidth.value) || 2
      }
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
      trace2.fillcolor = 'rgba(255, 0, 0, 0.2)';
    }
    
    if(errorBarsEnabled.checked){
      const errors = calculateError(data, yKeys[1], errorType.value, parseFloat(errorValue.value));
      trace2.error_y = {
        type: 'data',
        array: errors,
        visible: true,
        color: 'red'
      };
    }
    
    traces.push(trace2);
  }
  
  return traces;
}

// ============ 레이아웃 구성 ============
function buildLayout(data, xKeys, yKeys){
  // 범례 위치 파싱
  const posMap = {
    'top-right': {x: 1, y: 1, xanchor: 'right', yanchor: 'top'},
    'top-left': {x: 0, y: 1, xanchor: 'left', yanchor: 'top'},
    'bottom-right': {x: 1, y: 0, xanchor: 'right', yanchor: 'bottom'},
    'bottom-left': {x: 0, y: 0, xanchor: 'left', yanchor: 'bottom'},
    'outside': {x: 1.05, y: 1, xanchor: 'left', yanchor: 'top'}
  };
  
  const legendPos_val = legendPos.value || 'top-right';
  const legendPosObj = posMap[legendPos_val] || posMap['top-right'];
  
  // X축 레이블
  const xLabels = xKeys[0] ? data.map(r => String(r[xKeys[0]])) : data.map((_, i) => String(i));
  
  // 눈금선 투명도
  const gridOpacityVal = parseInt(gridOpacity.value) / 100 || 1;
  const gridColorRgba = hexToRgba(gridColor.value, gridOpacityVal);
  
  const layout = {
    title: {
      text: (document.getElementById('chartTitle') && document.getElementById('chartTitle').value) || '차트',
      font: {
        size: 14,
        family: 'Malgun Gothic, 맑은 고딕, Arial',
        color: '#000000'
      }
    },
    xaxis: {
      title: {
        text: xTitle.value || xKeys[0] || 'X',
        font: { size: 12, family: 'Malgun Gothic, 맑은 고딕, Arial' }
      },
      tickangle: -45,
      tickvals: data.map((_, i) => i),
      ticktext: xLabels,
      gridcolor: gridColorRgba || '#e5e5e5',
      showgrid: true,
      gridwidth: parseInt(gridWidth.value) || 1,
      zeroline: true,
      zerolinewidth: 1,
      zerolinecolor: '#000000',
      reverse: xReverse.checked || false,
      showline: true,
      linewidth: 2,
      linecolor: '#000000'
    },
    yaxis: {
      title: {
        text: yTitle.value || yKeys[0] || 'Y',
        font: { size: 12, family: 'Malgun Gothic, 맑은 고딕, Arial' }
      },
      type: yLog.checked ? 'log' : 'linear',
      gridcolor: gridColorRgba || '#e5e5e5',
      showgrid: true,
      gridwidth: parseInt(gridWidth.value) || 1,
      zeroline: true,
      zerolinewidth: 1,
      zerolinecolor: '#000000',
      reverse: yReverse.checked || false,
      showline: true,
      linewidth: 2,
      linecolor: '#000000'
    },
    margin: { t: 80, b: 100, l: 100, r: 60 },
    showlegend: legendShowLegend.checked !== false,
    legend: {
      x: legendPosObj.x,
      y: legendPosObj.y,
      xanchor: legendPosObj.xanchor,
      yanchor: legendPosObj.yanchor,
      bgcolor: 'rgba(255, 255, 255, 0.8)',
      bordercolor: '#000000',
      borderwidth: 1
    },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: {
      family: 'Malgun Gothic, 맑은 고딕, Arial',
      color: '#000000',
      size: 11
    },
    hovermode: 'closest',
    autosize: true
  };
  
  // 축 범위 설정
  const xMinVal = parseFloat(xMin.value);
  const xMaxVal = parseFloat(xMax.value);
  if(!isNaN(xMinVal) && !isNaN(xMaxVal)){
    layout.xaxis.range = [xMinVal, xMaxVal];
  }
  
  const yMinVal = parseFloat(yMin.value);
  const yMaxVal = parseFloat(yMax.value);
  if(!isNaN(yMinVal) && !isNaN(yMaxVal)){
    layout.yaxis.range = [yMinVal, yMaxVal];
  }
  
  // 두 번째 Y축
  if(yKeys[1]){
    layout.yaxis2 = {
      overlaying: 'y',
      side: 'right',
      title: yKeys[1],
      gridcolor: gridColorRgba,
      showgrid: true,
      gridwidth: parseInt(gridWidth.value) || 1
    };
  }
  
  return layout;
}

// ============ 16진수 색상을 RGBA로 변환 ============
function hexToRgba(hex, alpha = 1){
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ============ 차트 렌더링 ============
function renderPlot(targetEl){
  const xKeys = Array.from(xSelect.selectedOptions).map(o => o.value);
  const yKeys = Array.from(ySelect.selectedOptions).map(o => o.value);
  
  if(!state.data || yKeys.length === 0){
    targetEl.innerHTML = '<div class="p-4 text-sm text-gray-500">데이터와 Y축 필드를 선택하세요.</div>';
    return;
  }
  
  const agg = aggSelect.value || 'none';
  const chartType = chartTypeEl.value || 'scatter';
  
  state.chart.type = chartType;
  state.chart.agg = agg;
  
  const data = agg === 'none' ? state.data : aggregate(state.data, xKeys, yKeys, agg);
  aggregatedData = data;
  
  const traces = buildTraces(data, xKeys, yKeys, chartType);
  const layout = buildLayout(data, xKeys, yKeys);
  
  try {
    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d']
    };
    Plotly.newPlot(targetEl, traces, layout, config);
  } catch (err) {
    console.error('Plotly 렌더링 실패:', err);
    targetEl.innerHTML = '<div class="p-4 text-red-500">차트 렌더링 실패: ' + err.message + '</div>';
  }
}

function renderChart(){
  renderPlot(plotEl);
  renderPlot(plot2El);
}

// ============ 렌더 버튼 ============
renderBtn.addEventListener('click', () => {
  // If server-rendering is selected, send the uploaded file + settings to the server
  if(serverRenderCheckbox && serverRenderCheckbox.checked){
    renderServerPlot();
    setTab('chart');
    return;
  }

  renderChart();
  setTab('chart');
});

// ============ 고해상도 다운로드 ============
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

// ============ 실시간 렌더링 (설정 변경 시) ============
const settingsElements = [
  gridColor, gridWidth, gridOpacity, gridDash, 
  legendPos, legendShowLegend,
  seriesColor, lineWidth, markerSymbol, markerSize, markerColor,
  xTitle, yTitle, yLog, xMin, xMax, yMin, yMax, xReverse, yReverse,
  errorBarsEnabled, errorDirection, errorType, errorValue,
  trendlineEnabled, trendlineType, trendlineDegree, trendlineShowEq, trendlineShowR2, trendlineColor, trendlineWidth,
  dataLabelsEnabled, dataLabelsDecimals, dataLabelsFontSize, dataLabelsFontColor
];

settingsElements.forEach(el => {
  if(el){
    el.addEventListener('change', () => {
      if(aggregatedData) renderChart();
    });
  }
});

// ------------ Server-side rendering ----------------
async function renderServerPlot(){
  if(!fileInput || !fileInput.files || fileInput.files.length === 0){
    alert('엑셀 파일을 업로드하고 시트를 선택한 뒤 서버 렌더링을 시도하세요.');
    return;
  }

  const f = fileInput.files[0];
  const fd = new FormData();
  fd.append('file', f);
  fd.append('sheet', sheetSelect.value || '');

  // basic settings
  fd.append('xKeys', JSON.stringify(Array.from(xSelect.selectedOptions).map(o=>o.value)));
  fd.append('yKeys', JSON.stringify(Array.from(ySelect.selectedOptions).map(o=>o.value)));
  fd.append('agg', aggSelect.value || 'none');
  fd.append('chartType', chartTypeEl.value || 'scatter');
  fd.append('chartTitle', (document.getElementById('chartTitle') && document.getElementById('chartTitle').value) || '');

  // axis/grid/legend
  fd.append('xTitle', xTitle ? xTitle.value : '');
  fd.append('yTitle', yTitle ? yTitle.value : '');
  fd.append('xMin', xMin && xMin.value ? xMin.value : '');
  fd.append('xMax', xMax && xMax.value ? xMax.value : '');
  fd.append('yMin', yMin && yMin.value ? yMin.value : '');
  fd.append('yMax', yMax && yMax.value ? yMax.value : '');
  fd.append('yLog', yLog && yLog.checked ? '1' : '0');
  fd.append('gridColor', gridColor ? gridColor.value : '#cccccc');
  fd.append('gridWidth', gridWidth ? gridWidth.value : '1');
  fd.append('gridOpacity', gridOpacity ? gridOpacity.value : '30');
  fd.append('legendPos', legendPos ? legendPos.value : 'top-right');

  // series
  fd.append('seriesColor', seriesColor ? seriesColor.value : '#1f77b4');
  fd.append('lineWidth', lineWidth ? lineWidth.value : '2');
  fd.append('markerSymbol', markerSymbol ? markerSymbol.value : 'circle');
  fd.append('markerSize', markerSize ? markerSize.value : '8');

  // error / trend / labels
  fd.append('errorOn', errorBarsEnabled && errorBarsEnabled.checked ? '1' : '0');
  fd.append('errorType', errorType ? errorType.value : 'fixed');
  fd.append('errorValue', errorValue ? errorValue.value : '1');
  fd.append('trendOn', trendlineEnabled && trendlineEnabled.checked ? '1' : '0');
  fd.append('trendDegree', trendlineDegree ? trendlineDegree.value : '1');
  fd.append('trendColor', trendlineColor ? trendlineColor.value : '#ff7f0e');
  fd.append('labelOn', dataLabelsEnabled && dataLabelsEnabled.checked ? '1' : '0');
  fd.append('labelDecimals', dataLabelsDecimals ? dataLabelsDecimals.value : '2');

  try{
    serverImageContainer.classList.add('hidden');
    matplotImage.src = '';
    matplotDownload.classList.add('hidden');

    const resp = await fetch(RENDER_ENDPOINT, { method: 'POST', body: fd });
    if(!resp.ok){
      const txt = await resp.text();
      alert('서버 렌더링 실패: ' + resp.status + '\n' + txt);
      return;
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    matplotImage.src = url;
    serverImageContainer.classList.remove('hidden');
    matplotDownload.href = url;
    matplotDownload.download = 'matplotlib_render.png';
    matplotDownload.classList.remove('hidden');
  } catch(err){
    alert('서버 렌더 중 오류: ' + err.message);
  }
}

// If user toggles serverRender off, hide server image container
if(serverRenderCheckbox){
  serverRenderCheckbox.addEventListener('change', () => {
    if(!serverRenderCheckbox.checked){
      serverImageContainer.classList.add('hidden');
      matplotImage.src = '';
      matplotDownload.classList.add('hidden');
    }
  });
}
