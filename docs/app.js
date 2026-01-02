// app.js: 논문용 그래프 생성기 (Advanced Features)
// 포함 기능: 축/그리드 상세 설정, 오차막대, 추세선, 범례 위치 정밀 제어

const fileInput = document.getElementById('fileInput');
const btnLoad = document.getElementById('btnLoad');
const columnsArea = document.getElementById('columnsArea');
const btnPlot = document.getElementById('btnPlot');
const btnUpdate = document.getElementById('btnUpdatePreview');
const btnSwap = document.getElementById('btnSwapAxis');
const tabUpload = document.getElementById('tab-upload');
const tabEdit = document.getElementById('tab-edit');
const panelUpload = document.getElementById('panel-upload');
const panelEdit = document.getElementById('panel-edit');

let workbookData = null; 
let columns = [];
let isSwapped = false; // 축 교차 상태 관리

// 1. 탭 전환 UI 로직
function toggleTab(toEdit) {
  if(toEdit) {
    panelUpload.classList.add('hidden'); 
    panelEdit.classList.remove('hidden');
    // Active Tab Style
    tabEdit.className = "nav-tab px-6 py-2.5 text-sm font-bold bg-blue-600 text-white";
    tabUpload.className = "nav-tab px-6 py-2.5 text-sm font-bold bg-slate-200 text-slate-600 hover:bg-slate-300";
  } else {
    panelUpload.classList.remove('hidden'); 
    panelEdit.classList.add('hidden');
    // Active Tab Style
    tabUpload.className = "nav-tab px-6 py-2.5 text-sm font-bold bg-blue-600 text-white";
    tabEdit.className = "nav-tab px-6 py-2.5 text-sm font-bold bg-slate-200 text-slate-600 hover:bg-slate-300";
  }
}
tabUpload.addEventListener('click', () => toggleTab(false));
tabEdit.addEventListener('click', () => toggleTab(true));

// 2. 축 교차 (Swap) 버튼 로직
btnSwap.addEventListener('click', () => {
  isSwapped = !isSwapped;
  const swapText = document.getElementById('swapText');
  const btn = btnSwap;
  
  if (isSwapped) {
    btn.className = "flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold hover:bg-blue-500 transition shadow-lg";
    swapText.textContent = "축 교차 전환 (Swap X-Y) On";
  } else {
    btn.className = "flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-full text-sm font-bold hover:bg-slate-700 transition shadow-lg";
    swapText.textContent = "축 교차 전환 (Swap X-Y) Off";
  }
  // 데이터가 있으면 즉시 반영
  if (workbookData) btnPlot.click();
});

// 3. 파일 로드 및 파싱
btnLoad.addEventListener('click', () => {
  if (!fileInput.files.length) return alert('파일을 선택하세요.');
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    workbookData = XLSX.utils.sheet_to_json(ws, { defval: null });
    
    if(!workbookData || workbookData.length === 0) return alert('데이터가 비어있습니다.');
    
    columns = Object.keys(workbookData[0]);
    renderColumnControls();
    alert('데이터 로드 완료. 탭 하단의 계열 선택 영역을 확인하세요.');
  };
  reader.readAsArrayBuffer(fileInput.files[0]);
});

function renderColumnControls() {
  const selects = ['xAxisMain', 'xAxisSub', 'yAxisMain', 'yAxisSub'].map(id => document.getElementById(id));
  selects.forEach(sel => {
    sel.innerHTML = '<option value="">선택 안함</option>';
    columns.forEach(c => sel.add(new Option(c, c)));
  });

  columnsArea.innerHTML = '';
  columns.forEach(c => {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 bg-white p-2 rounded shadow-sm border border-slate-100';
    div.innerHTML = `
      <input type="checkbox" name="displayField" value="${c}" id="chk_${c}" class="w-4 h-4 cursor-pointer text-blue-600 rounded" />
      <label for="chk_${c}" class="text-xs truncate cursor-pointer font-bold text-slate-700 flex-1">${c}</label>
    `;
    columnsArea.appendChild(div);
  });
  
  // 체크박스 변경 시 상세 설정창(Series Formatting) 자동 갱신
  document.querySelectorAll('input[name="displayField"]').forEach(cb => {
    cb.addEventListener('change', () => renderSeriesControls());
  });
}

// 4. 메인 그래프 생성 함수
btnPlot.addEventListener('click', () => {
  if (!workbookData) return alert('데이터가 없습니다.');
  
  const xAxisMain = document.getElementById('xAxisMain').value;
  const xAxisSub = document.getElementById('xAxisSub').value;
  const yAxisMain = document.getElementById('yAxisMain').value;
  const yAxisSub = document.getElementById('yAxisSub').value;
  const displayFields = Array.from(document.querySelectorAll('input[name="displayField"]:checked')).map(i => i.value);

  if (!xAxisMain || displayFields.length === 0) return alert('Main X축과 최소 하나의 계열을 선택하세요.');

  // UI에서 상세 옵션 수집
  const opts = collectDetailedOptions();
  
  // 라벨 UI 업데이트 (리셋 방지)
  updateLabelsUI(xAxisMain, xAxisSub, yAxisMain, yAxisSub, displayFields);

  const traces = [];

  displayFields.forEach((ycol, idx) => {
    const activeX = (xAxisSub && idx > 0) ? xAxisSub : xAxisMain;
    
    // 유효 데이터 필터링
    let rawData = workbookData.map(row => ({ x: row[activeX], y: row[ycol] }))
                              .filter(d => d.x !== null && d.y !== null && d.x !== "" && d.y !== "");

    // X축 기준 정렬 (라인 차트 꼬임 방지)
    if (rawData.length > 0 && !isNaN(rawData[0].x)) {
      rawData.sort((a, b) => Number(a.x) - Number(b.x));
    }

    let finalX = rawData.map(d => d.x);
    let finalY = rawData.map(d => Number(d.y));

    // [중요] 축 교차(Swap) 처리
    if (isSwapped) {
      [finalX, finalY] = [finalY, finalX];
    }

    const sOpt = opts.series[ycol] || getDefaultSeriesStyle(ycol);
    
    // Trace 기본 설정
    const trace = {
      x: finalX, 
      y: finalY,
      name: sOpt.display_name,
      mode: (sOpt.show_line ? 'lines' : '') + (sOpt.show_marker ? '+markers' : '') + (sOpt.label_show ? '+text' : ''),
      type: document.getElementById('chartType').value,
      
      // g) 선과 표식 분리 구현
      line: { 
        color: sOpt.line_color, 
        width: sOpt.line_width, 
        dash: sOpt.line_dash 
      },
      marker: { 
        color: sOpt.marker_color, 
        size: sOpt.marker_size, 
        symbol: sOpt.marker_symbol, 
        opacity: sOpt.marker_opacity,
        line: { color: '#333', width: 0.5 } 
      },
      // f) 데이터 레이블 설정
      text: sOpt.label_show ? finalY.map(v => typeof v === 'number' ? v.toFixed(sOpt.label_round) : v) : null,
      textposition: 'top center',
      textfont: { size: sOpt.label_size, color: sOpt.label_color }
    };

    // d) 오차 막대 (Error Bars) 구현
    if (sOpt.error_type !== 'none') {
      const errObj = {
        type: 'data', visible: true, color: sOpt.line_color, thickness: 1.5, width: 4
      };
      
      let errVal = 0;
      if (sOpt.error_type === 'fixed') {
        errVal = sOpt.error_value;
        errObj.array = Array(finalY.length).fill(Number(errVal));
      }
      else if (sOpt.error_type === 'percent') {
        errObj.type = 'percent'; 
        errObj.value = sOpt.error_value;
      }
      else if (sOpt.error_type === 'sd' || sOpt.error_type === 'se') {
        // 표준편차/표준오차 계산
        const values = finalY;
        const n = values.length;
        if(n > 1) {
          const mean = values.reduce((a, b) => a + b, 0) / n;
          const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
          const sd = Math.sqrt(variance);
          errVal = sOpt.error_type === 'sd' ? sd : (sd / Math.sqrt(n));
          errObj.array = Array(n).fill(errVal);
        }
      }
      
      // 오차 방향 적용 (Swap 고려: 데이터가 이미 뒤집혔으므로 논리적 방향 적용)
      if (sOpt.error_direction === 'y' || sOpt.error_direction === 'both') {
         trace.error_y = errObj;
      }
      if (sOpt.error_direction === 'x' || sOpt.error_direction === 'both') {
         trace.error_x = { ...errObj };
      }
    }

    // 축 할당 (Swap 상태에 따라 보조축 위치 자동 조정)
    if (!isSwapped) {
      if (yAxisSub && ycol === yAxisSub) trace.yaxis = 'y2';
      if (xAxisSub && idx > 0) trace.xaxis = 'x2';
    } else {
      if (yAxisSub && ycol === yAxisSub) trace.xaxis = 'x2'; 
      if (xAxisSub && idx > 0) trace.yaxis = 'y2';
    }

    traces.push(trace);

    // e) 추세선 (Trendline) 계산 및 추가
    if (sOpt.trend_type !== 'none' && rawData.length > 1) {
       const trendTrace = calculateTrendline(finalX, finalY, sOpt.trend_type);
       if(trendTrace) {
         trendTrace.mode = 'lines';
         trendTrace.line = { color: sOpt.line_color, width: 1.5, dash: 'dot' };
         trendTrace.name = `${sOpt.display_name} (Trend)`;
         trendTrace.showlegend = false; 
         
         // 원래 계열의 축을 따라감
         trendTrace.xaxis = trace.xaxis;
         trendTrace.yaxis = trace.yaxis;

         // 수식 표시 옵션
         if (sOpt.trend_eq) {
            trendTrace.name += ` [${trendTrace.equation}]`;
            trendTrace.showlegend = true; 
         }
         traces.push(trendTrace);
       }
    }
  });

  // 레이아웃 구성
  const layout = {
    title: { text: document.getElementById('titleInput').value || '', font: { size: 18 } },
    template: 'plotly_white',
    margin: { l: 70, r: 70, t: 80, b: 80 },
    // c) 범례 설정 구현
    showlegend: opts.legend.show,
    legend: {
      orientation: opts.legend.orient,
      xanchor: opts.legend.pos.split(' ')[1], // left or right
      yanchor: opts.legend.pos.split(' ')[0], // top or bottom
      // Inside/Outside 좌표 계산 로직
      x: opts.legend.pos.includes('right') ? (opts.legend.type === 'inside' ? 0.98 : 1.02) : (opts.legend.type === 'inside' ? 0.02 : -0.15),
      y: opts.legend.pos.includes('top') ? (opts.legend.type === 'inside' ? 0.98 : 1) : 0.02,
      bgcolor: 'rgba(255,255,255,0.6)',
      bordercolor: '#ccc', borderwidth: 1
    },
    // a, b) 축 및 그리드 설정 (Swap 상태에 따라 라벨 스위칭)
    xaxis: getAxisLayout(opts.axis.x, opts.grid.x, isSwapped ? opts.labels.y : opts.labels.x),
    yaxis: getAxisLayout(opts.axis.y, opts.grid.y, isSwapped ? opts.labels.x : opts.labels.y),
  };

  // 보조축 레이아웃 구성
  if (!isSwapped) {
    if (yAxisSub) layout.yaxis2 = { ...getAxisLayout(opts.axis.y, opts.grid.y, opts.labels.ys), overlaying: 'y', side: 'right' };
    if (xAxisSub) layout.xaxis2 = { ...getAxisLayout(opts.axis.x, opts.grid.x, opts.labels.xs), overlaying: 'x', side: 'top' };
  } else {
    // Swap시: Y보조축 -> X보조축(Top), X보조축 -> Y보조축(Right)
    if (yAxisSub) layout.xaxis2 = { ...getAxisLayout(opts.axis.x, opts.grid.x, opts.labels.ys), overlaying: 'x', side: 'top' };
    if (xAxisSub) layout.yaxis2 = { ...getAxisLayout(opts.axis.y, opts.grid.y, opts.labels.xs), overlaying: 'y', side: 'right' };
  }

  const w = document.getElementById('chartWidth').value;
  const h = document.getElementById('chartHeight').value;
  if (w) layout.width = Number(w);
  if (h) layout.height = Number(h);

  Plotly.newPlot('previewArea', traces, layout, { responsive: true, displayModeBar: true });
});

// Helper: 축 레이아웃 생성기
function getAxisLayout(axisOpt, gridOpt, labelText) {
  const layout = {
    title: { text: labelText, font: { size: axisOpt.size, color: axisOpt.color }, standoff: 15 },
    showline: true, mirror: true, linewidth: 2, linecolor: '#333',
    showgrid: gridOpt.show,
    gridcolor: gridOpt.color,
    gridwidth: gridOpt.width,
    griddash: gridOpt.dash,
    tickfont: { size: 12 },
    type: axisOpt.log ? 'log' : '-',
    autorange: axisOpt.inv ? 'reversed' : false 
  };
  
  if (axisOpt.min !== '' && axisOpt.max !== '') layout.range = [Number(axisOpt.min), Number(axisOpt.max)];
  if (axisOpt.tick) layout.dtick = Number(axisOpt.tick);
  
  return layout;
}

// Helper: 추세선 계산 (선형 회귀 & 이동평균)
function calculateTrendline(x, y, type) {
  const n = x.length;
  if (n < 2) return null;

  // 선형 회귀 (Linear Regression)
  if (type === 'linear') {
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += x[i]; sumY += y[i];
      sumXY += x[i] * y[i]; sumXX += x[i] * x[i];
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // R-Squared 계산
    const yMean = sumY / n;
    let ssTot = 0, ssRes = 0;
    for(let i=0; i<n; i++) {
       const yPred = slope * x[i] + intercept;
       ssTot += Math.pow(y[i] - yMean, 2);
       ssRes += Math.pow(y[i] - yPred, 2);
    }
    const r2 = 1 - (ssRes / ssTot);

    const fitY = x.map(val => slope * val + intercept);
    return { x: x, y: fitY, equation: `y=${slope.toFixed(2)}x+${intercept.toFixed(2)}, R²=${r2.toFixed(3)}` };
  } 
  // 이동 평균 (Simple Moving Average)
  else if (type === 'moving_avg') {
    const window = 3; 
    const maY = [];
    const maX = [];
    for(let i=0; i <= n - window; i++) {
       let sum = 0;
       for(let j=0; j<window; j++) sum += y[i+j];
       maY.push(sum/window);
       maX.push(x[i+1]); 
    }
    return { x: maX, y: maY, equation: 'MA(3)' };
  }
  return null;
}

// UI 옵션 수집 함수 (DOM 접근)
function collectDetailedOptions() {
  const series = {};
  document.querySelectorAll('.series-control').forEach(sc => {
    const n = sc.dataset.name;
    series[n] = {
      display_name: sc.querySelector('.s-name').value,
      // Style
      line_color: sc.querySelector('.s-l-color').value,
      line_width: Number(sc.querySelector('.s-l-width').value),
      line_dash: sc.querySelector('.s-l-dash').value,
      show_line: sc.querySelector('.s-show-line').checked,
      marker_color: sc.querySelector('.s-m-color').value,
      marker_size: Number(sc.querySelector('.s-m-size').value),
      marker_symbol: sc.querySelector('.s-m-symbol').value,
      marker_opacity: Number(sc.querySelector('.s-m-opacity').value),
      show_marker: sc.querySelector('.s-show-marker').checked,
      // Labels
      label_show: sc.querySelector('.s-lbl-show').checked,
      label_size: Number(sc.querySelector('.s-lbl-size').value),
      label_color: sc.querySelector('.s-lbl-color').value,
      label_round: Number(sc.querySelector('.s-lbl-round').value),
      // Analytics
      error_type: sc.querySelector('.s-err-type').value,
      error_value: Number(sc.querySelector('.s-err-val').value),
      error_direction: sc.querySelector('.s-err-dir').value,
      trend_type: sc.querySelector('.s-trend-type').value,
      trend_eq: sc.querySelector('.s-trend-eq').checked
    };
  });

  return {
    axis: {
       x: { 
          min: document.getElementById('xMin').value, max: document.getElementById('xMax').value, 
          tick: document.getElementById('xTick').value, log: document.getElementById('xLog').checked, 
          inv: document.getElementById('xInv').checked, size: Number(document.getElementById('xTitleSize').value),
          color: document.getElementById('xTitleColor').value
       },
       y: { 
          min: document.getElementById('yMin').value, max: document.getElementById('yMax').value, 
          tick: document.getElementById('yTick').value, log: document.getElementById('yLog').checked, 
          inv: document.getElementById('yInv').checked, size: Number(document.getElementById('yTitleSize').value),
          color: document.getElementById('yTitleColor').value
       }
    },
    grid: {
       x: { show: document.getElementById('xGridShow').checked, color: document.getElementById('xGridColor').value, dash: document.getElementById('xGridDash').value, width: Number(document.getElementById('xGridWidth').value) },
       y: { show: document.getElementById('yGridShow').checked, color: document.getElementById('yGridColor').value, dash: document.getElementById('yGridDash').value, width: Number(document.getElementById('yGridWidth').value) }
    },
    legend: {
       show: document.getElementById('legendShow').checked,
       type: document.getElementById('legendType').value,
       pos: document.getElementById('legendPos').value,
       orient: document.getElementById('legendOrient').value
    },
    labels: {
       x: document.getElementById('xlabel_main').value, xs: document.getElementById('xlabel_sub') ? document.getElementById('xlabel_sub').value : '',
       y: document.getElementById('ylabel_main').value, ys: document.getElementById('ylabel_sub') ? document.getElementById('ylabel_sub').value : ''
    },
    series: series
  };
}

// 계열 설정 UI 렌더링
function renderSeriesControls() {
  const container = document.getElementById('seriesControls');
  const checked = Array.from(document.querySelectorAll('input[name="displayField"]:checked'));
  const oldData = collectDetailedOptions().series || {};

  container.innerHTML = '';
  const symbols = ['circle', 'square', 'triangle-up', 'diamond', 'cross', 'x'];
  const colors = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2'];

  checked.forEach((cb, i) => {
    const name = cb.value;
    const old = oldData[name] || {};
    
    // 기본값 설정
    const def = {
      display_name: name,
      l_color: old.line_color || colors[i % colors.length], l_width: old.line_width || 2, l_dash: old.line_dash || 'solid', show_l: old.show_line !== false,
      m_color: old.marker_color || colors[i % colors.length], m_size: old.marker_size || 8, m_sym: old.marker_symbol || symbols[i%symbols.length], m_op: old.marker_opacity || 1.0, show_m: old.show_marker !== false,
      lbl_show: old.label_show || false, lbl_size: old.label_size || 10, lbl_col: old.label_color || '#000000', lbl_rnd: old.label_round || 1,
      err_type: old.error_type || 'none', err_val: old.error_value || 0, err_dir: old.error_direction || 'both',
      trend_type: old.trend_type || 'none', trend_eq: old.trend_eq || false
    };

    const div = document.createElement('div');
    div.className = 'series-control p-3 border rounded-lg bg-white shadow-sm text-xs relative group';
    div.dataset.name = name;
    
    // 탭 형태의 HTML 구조 생성
    div.innerHTML = `
      <div class="mb-2 border-b pb-2">
         <label class="block text-[10px] font-bold text-slate-400">Legend Name</label>
         <input type="text" class="s-name w-full font-bold border-none p-0 focus:ring-0 text-sm" value="${def.display_name}">
      </div>
      
      <details class="mb-1">
         <summary class="font-bold text-slate-600 bg-slate-50 p-1.5 rounded cursor-pointer">🎨 Style (Line/Marker)</summary>
         <div class="p-2 space-y-2 border-l border-slate-200 ml-1">
            <div class="flex items-center justify-between"><span class="font-bold">Line</span> <label><input type="checkbox" class="s-show-line" ${def.show_l?'checked':''}> Show</label></div>
            <div class="grid grid-cols-3 gap-1">
               <input type="color" class="s-l-color h-6 w-full" value="${def.l_color}">
               <input type="number" class="s-l-width input-xs" value="${def.l_width}" step="0.5">
               <select class="s-l-dash input-xs"><option value="solid">Solid</option><option value="dash">Dash</option><option value="dot">Dot</option></select>
            </div>
            <div class="flex items-center justify-between mt-2"><span class="font-bold">Marker</span> <label><input type="checkbox" class="s-show-marker" ${def.show_m?'checked':''}> Show</label></div>
            <div class="grid grid-cols-2 gap-1">
               <input type="color" class="s-m-color h-6 w-full" value="${def.m_color}">
               <select class="s-m-symbol input-xs"><option value="circle">●</option><option value="square">■</option><option value="triangle-up">▲</option><option value="diamond">◆</option></select>
               <input type="number" class="s-m-size input-xs" value="${def.m_size}" placeholder="Size">
               <input type="number" class="s-m-opacity input-xs" value="${def.m_op}" step="0.1" max="1" placeholder="Alpha">
            </div>
         </div>
      </details>

      <details class="mb-1">
         <summary class="font-bold text-slate-600 bg-slate-50 p-1.5 rounded cursor-pointer">🔤 Labels</summary>
         <div class="p-2 grid grid-cols-2 gap-2 border-l border-slate-200 ml-1">
            <label class="col-span-2"><input type="checkbox" class="s-lbl-show" ${def.lbl_show?'checked':''}> Show Values</label>
            <div><label class="label-xs">Size</label><input type="number" class="s-lbl-size input-xs" value="${def.lbl_size}"></div>
            <div><label class="label-xs">Color</label><input type="color" class="s-lbl-color h-6 w-full" value="${def.lbl_col}"></div>
            <div><label class="label-xs">Decimals</label><input type="number" class="s-lbl-round input-xs" value="${def.lbl_rnd}"></div>
         </div>
      </details>

      <details>
         <summary class="font-bold text-slate-600 bg-slate-50 p-1.5 rounded cursor-pointer">📈 Analytics</summary>
         <div class="p-2 space-y-2 border-l border-slate-200 ml-1">
            <div>
               <label class="label-xs">Error Bars</label>
               <select class="s-err-type input-xs mb-1">
                  <option value="none">None</option>
                  <option value="fixed">Fixed</option>
                  <option value="percent">Percent(%)</option>
                  <option value="sd">Std Dev</option>
                  <option value="se">Std Error</option>
               </select>
               <div class="flex gap-1">
                  <input type="number" class="s-err-val input-xs" value="${def.err_val}" placeholder="Value">
                  <select class="s-err-dir input-xs w-16"><option value="both">Both</option><option value="y">Y</option><option value="x">X</option></select>
               </div>
            </div>
            <div class="border-t pt-2">
               <label class="label-xs">Trendline</label>
               <select class="s-trend-type input-xs mb-1">
                  <option value="none">None</option>
                  <option value="linear">Linear</option>
                  <option value="moving_avg">Mov. Avg</option>
               </select>
               <label class="flex items-center text-[10px]"><input type="checkbox" class="s-trend-eq mr-1" ${def.trend_eq?'checked':''}> Equation / R²</label>
            </div>
         </div>
      </details>
    `;
    
    // Select 값 강제 설정 (innerHTML 버그 방지)
    div.querySelector('.s-l-dash').value = def.l_dash;
    div.querySelector('.s-m-symbol').value = def.m_sym;
    div.querySelector('.s-err-type').value = def.err_type;
    div.querySelector('.s-err-dir').value = def.err_dir;
    div.querySelector('.s-trend-type').value = def.trend_type;

    container.appendChild(div);
  });
}

function updateLabelsUI(xMain, xSub, yMain, ySub, yFields) {
  const xCon = document.getElementById('xlabels-container');
  const yCon = document.getElementById('ylabels-container');
  
  const existXM = document.getElementById('xlabel_main');
  const existXS = document.getElementById('xlabel_sub');
  const existYM = document.getElementById('ylabel_main');
  const existYS = document.getElementById('ylabel_sub');

  const valXM = existXM ? existXM.value : xMain;
  const valXS = existXS ? existXS.value : (xSub || '');
  const valYM = existYM ? existYM.value : (yMain || yFields[0]);
  const valYS = existYS ? existYS.value : (ySub || '');

  let xHtml = `<input id="xlabel_main" class="input-xs" value="${valXM}" placeholder="Main X Label" />`;
  if(xSub) xHtml += `<input id="xlabel_sub" class="input-xs mt-1 border-dashed" value="${valXS}" placeholder="Sub X Label" />`;
  xCon.innerHTML = xHtml;

  let yHtml = `<input id="ylabel_main" class="input-xs" value="${valYM}" placeholder="Main Y Label" />`;
  if(ySub) yHtml += `<input id="ylabel_sub" class="input-xs mt-1 border-dashed" value="${valYS}" placeholder="Sub Y Label" />`;
  yCon.innerHTML = yHtml;
}

function getDefaultSeriesStyle(name) {
  return { 
    display_name: name, 
    show_line: true, line_color: '#333', line_width: 2, line_dash: 'solid',
    show_marker: true, marker_color: '#333', marker_size: 7, marker_symbol: 'circle', marker_opacity: 1,
    label_show: false, label_round: 1, label_size: 10, label_color: '#000',
    error_type: 'none', trend_type: 'none'
  };
}

// 이벤트 초기화
btnUpdate.addEventListener('click', () => btnPlot.click());
