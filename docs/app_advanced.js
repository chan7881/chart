// app_advanced.js - 고급 기능 포함 리팩토링 버전
let workbook, currentSheetName, jsonData, aggregatedData;

const state = {
  data: null,
  fields: [],
  selected: { x: [], y: [] },
  chart: { type: 'scatter', agg: 'none', title: '차트' },
  axis: { 
    xMin: null, xMax: null, yMin: null, yMax: null,
    xReverse: false, yReverse: false
  },
  grid: {
    color: '#cccccc', width: 1, opacity: 1, dash: 'solid'
  },
  legend: {
    position: 'top-right', show: true
  },
  series: {
    color: '#1f77b4', lineWidth: 2,
    marker: { symbol: 'circle', size: 8, color: '#1f77b4' }
  },
  errorBars: {
    enabled: false, direction: 'y', type: 'fixed', value: 1
  },
  trendline: {
    enabled: false, type: 'linear', degree: 2,
    showEq: false, showR2: true, color: '#ff7f0e', width: 2
  },
  dataLabels: {
    enabled: false, decimals: 2, fontSize: 12, fontColor: '#000000'
  }
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

// 고급 설정 활성화/비활성화
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
      } else {
        row[yk] = v.sums[yk] || 0;
      }
      // 표준편차 계산용 저장
      row[yk + '_values'] = v.values[yk] || [];
    });
    out.push(row);
  }
  
  return out;
}

// 표준편차 계산
function calculateStdev(values){
  if(values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b) / values.length;
  const variance = values.reduce((a, v) => a + Math.pow(v - mean, 2)) / (values.length - 1);
  return Math.sqrt(variance);
}

// 오차 막대 계산
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

// 추세선 계산 (선형)
function calculateLinearTrendline(xData, yData){
  const n = xData.length;
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
  const r2 = 1 - (ssRes / ssTotal);
  
  return {
    equation: `y = ${slope.toFixed(3)}x + ${intercept.toFixed(3)}`,
    r2: r2,
    predictions: predictions
  };
}

// 트레이스 생성 (고급 기능 포함)
function buildTraces(data, xKeys, yKeys, chartType){
  const traces = [];
  const x = data.map((r, i) => i);
  
  if(yKeys[0]){
    const yData = data.map(r => r[yKeys[0]]);
    const trace = {
      x: x,
      y: yData,
      name: yKeys[0],
      marker: { 
        color: markerColor.value || seriesColor.value,
        size: parseInt(markerSize.value),
        symbol: markerSymbol.value
      },
      line: {
        color: seriesColor.value,
        width: parseInt(lineWidth.value)
      }
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
    
    // 오차 막대
    if(state.errorBars.enabled && state.errorBars.direction === 'y'){
      const errors = calculateError(data, yKeys[0], state.errorBars.type, parseFloat(errorValue.value));
      trace.error_y = {
        type: 'data',
        array: errors,
        visible: true
      };
    }
    
    // 데이터 레이블 (customdata + 주석으로 표현)
    if(state.dataLabels.enabled){
      trace.customdata = yData.map(v => v.toFixed(parseInt(dataLabelsDecimals.value)));
      trace.text = trace.customdata;
      trace.textposition = 'top center';
      trace.textfont = {
        size: parseInt(dataLabelsFontSize.value),
        color: dataLabelsFontColor.value
      };
      trace.mode = (trace.mode || '') + '+text';
    }
    
    traces.push(trace);
    
    // 추세선
    if(state.trendline.enabled && (chartType === 'scatter' || chartType === 'line')){
      const trendResult = calculateLinearTrendline(x, yData);
      const trendTrace = {
        x: x,
        y: trendResult.predictions,
        name: `${yKeys[0]} (추세선)`,
        type: 'scatter',
        mode: 'lines',
        line: {
          color: trendlineColor.value,
          width: parseInt(trendlineWidth.value),
          dash: 'dash'
        },
        hovertemplate: state.trendline.showEq && state.trendline.showR2 
          ? `<b>${trendResult.equation}</b><br>R² = ${trendResult.r2.toFixed(4)}<extra></extra>`
          : '%{y}<extra></extra>'
      };
      traces.push(trendTrace);
    }
  }
  
  // 두 번째 Y축 데이터
  if(yKeys[1]){
    const yData2 = data.map(r => r[yKeys[1]]);
    const trace2 = {
      x: x,
      y: yData2,
      name: yKeys[1],
      yaxis: 'y2',
      marker: { size: parseInt(markerSize.value) },
      line: { width: parseInt(lineWidth.value) }
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
    
    if(state.errorBars.enabled && state.errorBars.direction === 'y'){
      const errors = calculateError(data, yKeys[1], state.errorBars.type, parseFloat(errorValue.value));
      trace2.error_y = {
        type: 'data',
        array: errors,
        visible: true
      };
    }
    
    traces.push(trace2);
  }
  
  return traces;
}

// 레이아웃 구성
function buildLayout(data, xKeys, yKeys, chartType){
  // 범례 위치 파싱
  let legendX = 0.5, legendY = 0.5, legendXAnchor = 'center', legendYAnchor = 'middle';
  if(legendPos.value === 'top-right') { legendX = 1; legendY = 1; legendXAnchor = 'right'; legendYAnchor = 'top'; }
  else if(legendPos.value === 'top-left') { legendX = 0; legendY = 1; legendXAnchor = 'left'; legendYAnchor = 'top'; }
  else if(legendPos.value === 'bottom-right') { legendX = 1; legendY = 0; legendXAnchor = 'right'; legendYAnchor = 'bottom'; }
  else if(legendPos.value === 'bottom-left') { legendX = 0; legendY = 0; legendXAnchor = 'left'; legendYAnchor = 'bottom'; }
  else if(legendPos.value === 'outside') { legendXAnchor = 'left'; }
  
  // 눈금선 대시 스타일 변환 (Plotly용)
  const dashMap = { 'solid': '', 'dot': 'dot', 'dash': 'dash', 'dashdot': 'dashdot' };
  const gridDashValue = dashMap[gridDash.value] || '';
  
  const xLabels = xKeys[0] ? data.map(r => String(r[xKeys[0]])) : data.map((_, i) => String(i));
  const gridOpacityValue = parseInt(gridOpacity.value) / 100;
  const gridColorRgba = gridColor.value + (gridOpacityValue < 1 ? Math.floor(gridOpacityValue * 255).toString(16) : '');
  
  const layout = {
    title: '차트',
    xaxis: {
      title: xTitle.value || xKeys[0] || '',
      tickangle: -45,
      tickvals: data.map((_, i) => i),
      ticktext: xLabels,
      gridcolor: gridColor.value,
      showgrid: true,
      gridwidth: parseInt(gridWidth.value),
      reverse: xReverse.checked,
      range: xMin.value && xMax.value ? [parseFloat(xMin.value), parseFloat(xMax.value)] : undefined
    },
    yaxis: {
      title: yTitle.value || yKeys[0] || '',
      type: yLog.checked ? 'log' : 'linear',
      gridcolor: gridColor.value,
      showgrid: true,
      gridwidth: parseInt(gridWidth.value),
      reverse: yReverse.checked,
      range: yMin.value && yMax.value ? [parseFloat(yMin.value), parseFloat(yMax.value)] : undefined
    },
    margin: { t: 60, b: 140, l: 80, r: 80 },
    showlegend: legendShowLegend.checked,
    legend: {
      orientation: legendPos.value === 'outside' ? 'v' : (legendPos.value.includes('top') || legendPos.value.includes('bottom') ? 'h' : 'v'),
      x: legendX,
      y: legendY,
      xanchor: legendXAnchor,
      yanchor: legendYAnchor
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
      gridcolor: gridColor.value,
      showgrid: true,
      gridwidth: parseInt(gridWidth.value)
    };
  }
  
  return layout;
}

// 차트 렌더링
function renderPlot(targetEl){
  const xKeys = Array.from(xSelect.selectedOptions).map(o => o.value);
  const yKeys = Array.from(ySelect.selectedOptions).map(o => o.value);
  
  if(!state.data || yKeys.length === 0){
    targetEl.innerHTML = '<div class="p-4 text-sm text-gray-500">데이터와 Y축 필드를 선택하세요.</div>';
    return;
  }
  
  // state 업데이트
  state.chart.type = chartTypeEl.value;
  state.chart.agg = aggSelect.value;
  state.axis.xMin = parseFloat(xMin.value) || null;
  state.axis.xMax = parseFloat(xMax.value) || null;
  state.axis.yMin = parseFloat(yMin.value) || null;
  state.axis.yMax = parseFloat(yMax.value) || null;
  state.axis.xReverse = xReverse.checked;
  state.axis.yReverse = yReverse.checked;
  state.grid.color = gridColor.value;
  state.grid.width = parseInt(gridWidth.value);
  state.grid.opacity = parseInt(gridOpacity.value) / 100;
  state.grid.dash = gridDash.value;
  state.legend.position = legendPos.value;
  state.legend.show = legendShowLegend.checked;
  state.series.color = seriesColor.value;
  state.series.lineWidth = parseInt(lineWidth.value);
  state.series.marker.symbol = markerSymbol.value;
  state.series.marker.size = parseInt(markerSize.value);
  state.series.marker.color = markerColor.value;
  state.errorBars.enabled = errorBarsEnabled.checked;
  state.errorBars.direction = errorDirection.value;
  state.errorBars.type = errorType.value;
  state.errorBars.value = parseFloat(errorValue.value);
  state.trendline.enabled = trendlineEnabled.checked;
  state.trendline.type = trendlineType.value;
  state.trendline.degree = parseInt(trendlineDegree.value);
  state.trendline.showEq = trendlineShowEq.checked;
  state.trendline.showR2 = trendlineShowR2.checked;
  state.trendline.color = trendlineColor.value;
  state.trendline.width = parseInt(trendlineWidth.value);
  state.dataLabels.enabled = dataLabelsEnabled.checked;
  state.dataLabels.decimals = parseInt(dataLabelsDecimals.value);
  state.dataLabels.fontSize = parseInt(dataLabelsFontSize.value);
  state.dataLabels.fontColor = dataLabelsFontColor.value;
  
  const agg = aggSelect.value;
  const chartType = chartTypeEl.value;
  
  const data = agg === 'none' ? state.data : aggregate(state.data, xKeys, yKeys, agg);
  aggregatedData = data;
  
  const traces = buildTraces(data, xKeys, yKeys, chartType);
  const layout = buildLayout(data, xKeys, yKeys, chartType);
  
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

// 이벤트 리스너
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

// 설정값 변경 시 실시간 렌더링 (선택사항)
[gridColor, gridWidth, gridOpacity, gridDash, legendPos, legendShowLegend,
 seriesColor, lineWidth, markerSymbol, markerSize, markerColor,
 xTitle, yTitle, yLog, xMin, xMax, yMin, yMax, xReverse, yReverse].forEach(el => {
  if(el) el.addEventListener('change', () => {
    if(aggregatedData) renderChart();
  });
});
