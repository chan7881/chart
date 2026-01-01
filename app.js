// docs/app.js: frontend-only Excel -> Plotly pipeline

const fileInput = document.getElementById('fileInput');
const btnLoad = document.getElementById('btnLoad');
const columnsArea = document.getElementById('columnsArea');
const btnPlot = document.getElementById('btnPlot');
const previewArea = document.getElementById('previewArea');
const tabUpload = document.getElementById('tab-upload');
const tabEdit = document.getElementById('tab-edit');
const panelUpload = document.getElementById('panel-upload');
const panelEdit = document.getElementById('panel-edit');
const btnUpdate = document.getElementById('btnUpdatePreview');

// state: track swapped columns
let isSwapped = false;
let selectedYFields = []; // track Y fields for multi-label support

tabUpload.addEventListener('click', ()=>{panelUpload.classList.remove('hidden');panelEdit.classList.add('hidden');tabUpload.classList.add('bg-blue-500');tabEdit.classList.remove('bg-blue-500');});
tabEdit.addEventListener('click', ()=>{panelUpload.classList.add('hidden');panelEdit.classList.remove('hidden');tabEdit.classList.add('bg-blue-500');tabUpload.classList.remove('bg-blue-500');});

let workbookData = null; // array of objects
let columns = [];

btnLoad.addEventListener('click', ()=>{
  if (!fileInput.files.length) return alert('엑셀 파일을 선택하세요');
  const f = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = (e)=>{
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, {type:'array'});
    const first = wb.SheetNames[0];
    const ws = wb.Sheets[first];
    const aoa = XLSX.utils.sheet_to_json(ws, {defval: null});
    workbookData = aoa; // array of row objects
    columns = Object.keys(aoa[0]||{});
    renderColumns(columns);
    alert('파일 로드 완료: '+first + ' 시트, 행수: ' + aoa.length);
  };
  reader.readAsArrayBuffer(f);
});

function renderColumns(cols){
  // Populate axis dropdowns
  const xAxisMainSel = document.getElementById('xAxisMain');
  const xAxisSubSel = document.getElementById('xAxisSub');
  const yAxisMainSel = document.getElementById('yAxisMain');
  const yAxisSubSel = document.getElementById('yAxisSub');
  
  // Store current selections
  const xMainVal = xAxisMainSel.value;
  const xSubVal = xAxisSubSel.value;
  const yMainVal = yAxisMainSel.value;
  const ySubVal = yAxisSubSel.value;
  
  // Clear and rebuild dropdowns (keep first option "선택 안함")
  [xAxisMainSel, xAxisSubSel, yAxisMainSel, yAxisSubSel].forEach(sel => {
    while(sel.children.length > 1) sel.removeChild(sel.lastChild);
  });
  
  cols.forEach(c => {
    const opt1 = document.createElement('option'); opt1.value = c; opt1.textContent = c;
    const opt2 = document.createElement('option'); opt2.value = c; opt2.textContent = c;
    const opt3 = document.createElement('option'); opt3.value = c; opt3.textContent = c;
    const opt4 = document.createElement('option'); opt4.value = c; opt4.textContent = c;
    xAxisMainSel.appendChild(opt1);
    xAxisSubSel.appendChild(opt2);
    yAxisMainSel.appendChild(opt3);
    yAxisSubSel.appendChild(opt4);
  });
  
  // Restore previous selections if they still exist
  if(cols.includes(xMainVal)) xAxisMainSel.value = xMainVal;
  if(cols.includes(xSubVal)) xAxisSubSel.value = xSubVal;
  if(cols.includes(yMainVal)) yAxisMainSel.value = yMainVal;
  if(cols.includes(ySubVal)) yAxisSubSel.value = ySubVal;
  
  // Render checkboxes for displaying values
  columnsArea.innerHTML = '';
  const left = document.createElement('div');
  const right = document.createElement('div');
  cols.forEach((c,i)=>{
    const el = document.createElement('div');
    el.className = 'p-2';
    el.innerHTML = `
      <label class="text-sm inline-flex items-center">
        <input type="checkbox" name="displayField" value="${c}" class="mr-2" />
        ${c}
      </label>
    `;
    if (i % 2 === 0) left.appendChild(el); else right.appendChild(el);
  });
  columnsArea.appendChild(left);
  columnsArea.appendChild(right);
  attachSeriesSettingsListeners();
}

// pivot/groupby & aggregation (mean)
function pivotAndAggregate(data, groupCols, aggCols){
  if (!groupCols.length) return data.map(r=>({__index: data.indexOf(r), ...r}));
  const map = new Map();
  data.forEach(row=>{
    const key = groupCols.map(c=>String(row[c])).join('||');
    if (!map.has(key)) map.set(key, {count:0});
    const entry = map.get(key);
    groupCols.forEach(c=> entry[c]=row[c]);
    aggCols.forEach(c=>{ entry[c] = (entry[c]||0) + (row[c] == null ? 0 : Number(row[c])); });
    entry.count += 1;
  });
  const out = [];
  map.forEach(v=>{
    const obj = {};
    groupCols.forEach(c=>obj[c]=v[c]);
    aggCols.forEach(c=> obj[c] = v.count ? (v[c]/v.count) : null );
    out.push(obj);
  });
  return out;
}

// simple polyfit using math.js
function polyfit(x, y, degree){
  const n = x.length;
  const V = [];
  for (let i=0;i<n;i++){
    const row = [];
    for (let j=0;j<=degree;j++) row.push(Math.pow(x[i], j));
    V.push(row);
  }
  const VT = math.transpose(V);
  const VTV = math.multiply(VT, V);
  const inv = math.inv(VTV);
  const VTy = math.multiply(VT, y);
  const coeffs = math.multiply(inv, VTy); // vector
  return coeffs; // array of coefficients [a0, a1, ...]
}

function polyval(coeffs, x){
  return x.map(xx=> coeffs.reduce((s,c,i)=> s + c * Math.pow(xx,i), 0));
}

btnPlot.addEventListener('click', async ()=>{
  if (!workbookData) return alert('먼저 파일을 로드하세요');
  
  // Get axis selections from dropdowns
  const xAxisMain = document.getElementById('xAxisMain').value;
  const xAxisSub = document.getElementById('xAxisSub').value;
  const yAxisMain = document.getElementById('yAxisMain').value;
  const yAxisSub = document.getElementById('yAxisSub').value;
  
  // Get values to display from checkboxes
  const displayChecks = Array.from(document.querySelectorAll('input[name="displayField"]:checked'));
  const displayFields = displayChecks.map(i => i.value);
  
  if (!xAxisMain && !xAxisSub) return alert('X축을 최소 1개 선택하세요');
  if (!yAxisMain && !yAxisSub) return alert('Y축을 최소 1개 선택하세요');
  if (displayFields.length === 0) return alert('표시할 값을 최소 1개 선택하세요');
  
  // Use main axes for grouping/pivot (only main axes used for aggregation)
  const x_fields = xAxisMain ? [xAxisMain] : [];
  const y_fields = yAxisMain ? [yAxisMain] : [];
  selectedYFields = displayFields; // store for label UI
  const chartType = document.getElementById('chartType').value;

  // pivot/groupby using main axes only
  let plot_df = workbookData;
  if (x_fields.length && y_fields.length){
    plot_df = pivotAndAggregate(workbookData, x_fields, y_fields);
  }

  // Update Y-axis and X-axis label UI based on actual axis selections
  const axis_labels = [];
  if (yAxisMain) axis_labels.push(yAxisMain);
  if (yAxisSub) axis_labels.push(yAxisSub);
  updateYAxisLabelUI(axis_labels);
  const x_axis_labels = [];
  if (xAxisMain) x_axis_labels.push(xAxisMain);
  if (xAxisSub) x_axis_labels.push(xAxisSub);
  updateXAxisLabelUI(x_axis_labels);

  // build traces
  const traces = [];
  const layout = {
    title: {text: document.getElementById('titleInput').value || '', font:{size:14, family:'Arial, sans-serif', color:'#000'}},
    xaxis:{title: {text: document.getElementById('xlabel_0')?.value || (x_fields[0]||''), font:{size:12, color:'#000'}}, showgrid:false, zeroline:false, showline:true, linewidth:1.5, linecolor:'#000', mirror:true},
    yaxis:{title: {text: document.getElementById('ylabel_0')?.value || document.getElementById('ylabelInput').value || (displayFields[0]||''), font:{size:12, color:'#000'}}, showgrid:false, zeroline:false, showline:true, linewidth:1.5, linecolor:'#000', mirror:true},
    template:'plotly_white',
    font:{family:'Arial, sans-serif', size:11, color:'#000'},
    margin:{l:60, r:40, t:50, b:50},
    hovermode:'closest'
  };

  const options = collectOptionsFromUI();

  const xvals = x_fields.length ? plot_df.map(r=>r[x_fields[0]]) : plot_df.map((r,i)=>i);

  // Only plot selected display fields
  displayFields.forEach((ycol, idx)=>{
    const yvals = plot_df.map(r=>Number(r[ycol]));
    const color = options.series[ycol]?.color || '#000000'; // Default to black
    const trace = {
      x: xvals,
      y: yvals,
      name: ycol,
      mode: (options.series[ycol]?.show_line ? 'lines' : '') + (options.series[ycol]?.show_marker ? '+markers' : ''),
      marker: {color: color, size: options.series[ycol]?.markersize || 6, opacity: 1.0, symbol: options.series[ycol]?.marker || 'circle'},
      line: {color: color, width: options.series[ycol]?.linewidth || 2, dash: options.series[ycol]?.linestyle || 'solid'},
    };
    // errorbars removed

    // dual axis: if there are 2 Y axes and this is the second trace, assign to yaxis: 'y2'
    if (idx===1 && yAxisSub && options.dual_axis){
      trace.yaxis = 'y2';
    }

    traces.push(trace);

    // trendline
    if (options.trendline.enabled){
      if (options.trendline.type==='linear'){
        // linear fit
        const xv = xvals.map(Number);
        const yv = yvals.map(Number);
        const xmean = xv.reduce((a,b)=>a+b,0)/xv.length;
        const ymean = yv.reduce((a,b)=>a+b,0)/yv.length;
        let num=0, den=0;
        for (let i=0;i<xv.length;i++){ num += (xv[i]-xmean)*(yv[i]-ymean); den += Math.pow(xv[i]-xmean,2); }
        const slope = den===0?0: num/den; const intercept = ymean - slope*xmean;
        const trendY = xv.map(xx=> intercept + slope*xx);
        traces.push({x:xv, y:trendY, mode:'lines', name: ycol + ' 추세선', line:{dash: options.trendline.style || 'dash', width: options.trendline.width || 2, color: options.trendline.color || color}});
        if (options.trendline.showEq){
          const eq = `y=${slope.toFixed(3)}x+${intercept.toFixed(3)}`;
          layout.annotations = (layout.annotations||[]).concat([{x: xv[Math.floor(xv.length/2)], y: trendY[Math.floor(trendY.length/2)], text: eq, showarrow:false}]);
        }
      } else if (options.trendline.type==='poly'){
        const deg = Math.max(1, parseInt(options.trendline.degree||2,10));
        const xv = xvals.map(Number); const yv = yvals.map(Number);
        try{
          const coeffs = polyfit(xv, yv, deg); // math.js vector
          const coeffsArr = coeffs.map(c=>c);
          const trendY = polyval(coeffsArr, xv);
          traces.push({x:xv, y:trendY, mode:'lines', name: ycol + ' 추세선', line:{dash: options.trendline.style || 'dash', width: options.trendline.width || 2, color: options.trendline.color || color}});
          if (options.trendline.showEq){
            const eq = coeffsArr.map((c,i)=> `${c.toFixed(3)}x^${i}` ).join(' + ');
            layout.annotations = (layout.annotations||[]).concat([{x: xv[Math.floor(xv.length/2)], y: trendY[Math.floor(trendY.length/2)], text: eq, showarrow:false, font:{size:10}}]);
          }
        }catch(e){ console.warn('polyfit 실패', e); }
      }
    }

    // data labels
    if (options.datalabels.enabled){
      const labels = yvals.map(v=> (Number(v).toFixed(options.datalabels.decimals||0)) );
      trace.text = labels; trace.textposition = 'top center';
    }

  });

  // grid
  if (options.grid.enabled){
    layout.xaxis.showgrid = true;
    layout.xaxis.gridcolor = options.grid.color;
    layout.xaxis.gridwidth = 1;
    layout.yaxis.showgrid = true;
    layout.yaxis.gridcolor = options.grid.color;
    layout.yaxis.gridwidth = 1;
  }

  // legend position
  if (options.legend.position){
    if (options.legend.position==='outside'){
      layout.legend = {x:1.02, y:1, xanchor:'left'};
    } else {
      const mapPos = {'top right':{x:1,y:1,'xanchor':'right','yanchor':'top'}, 'top left':{x:0,y:1,'xanchor':'left','yanchor':'top'}, 'bottom left':{x:0,y:0,'xanchor':'left','yanchor':'bottom'}, 'bottom right':{x:1,y:0,'xanchor':'right','yanchor':'bottom'}};
      layout.legend = mapPos[options.legend.position] || {};
    }
  }

  // legend visibility
  layout.showlegend = document.getElementById('legendShow') ? document.getElementById('legendShow').checked : true;

  // axis ranges and log
  if (options.axis.xlim){ layout.xaxis.range = options.axis.xlim.map(Number); }
  if (options.axis.ylim){ layout.yaxis.range = options.axis.ylim.map(Number); }
  if (options.axis.xlog){ layout.xaxis.type='log'; }
  if (options.axis.yinvert){ layout.yaxis.autorange='reversed'; }

  // X axis 2 title (if second X selected)
  if (xAxisSub){
    const x2label = document.getElementById('xlabel_1')?.value || xAxisSub || '';
    layout.xaxis2 = {overlaying: 'x', side: 'top', title: {text: x2label, font:{size:12, color:'#000'}}, showgrid:false, zeroline:false, showline:true, linewidth:1.5, linecolor:'#000', mirror:true};
  }

  // Y axis 2 title (if second Y selected)
  if (yAxisSub){
    const y2label = document.getElementById('ylabel_1')?.value || yAxisSub || '';
    layout.yaxis2 = {overlaying: 'y', side: 'right', title: {text: y2label, font:{size:12, color:'#000'}}, showgrid:false, zeroline:false, showline:true, linewidth:1.5, linecolor:'#000', mirror:true};
  }

  // render
  previewArea.innerHTML = '';
  const gd = document.createElement('div'); previewArea.appendChild(gd);
  // apply optional user-specified size: set element style and Plotly layout dims
  if (options.size && options.size.width){
    gd.style.width = options.size.width + 'px';
    layout.width = options.size.width;
  } else {
    gd.style.width = '100%';
    if (layout.width) delete layout.width;
  }
  if (options.size && options.size.height){
    gd.style.height = options.size.height + 'px';
    layout.height = options.size.height;
  } else {
    gd.style.height = '480px';
    if (layout.height) delete layout.height;
  }
  Plotly.newPlot(gd, traces, layout, {responsive:true, displayModeBar:false});

});

function collectOptionsFromUI(){
  const options = {};
  options.xlabel = document.getElementById('xlabel_0')?.value || document.getElementById('xlabelInput')?.value || '';
  options.ylabel = document.getElementById('ylabel_0')?.value || document.getElementById('ylabelInput')?.value || '';
  options.axis = {};
  // chart size (pixels) - optional
  options.size = {};
  const wVal = (document.getElementById('chartWidth')?.value || '').toString().trim();
  const hVal = (document.getElementById('chartHeight')?.value || '').toString().trim();
  if (wVal !== '') options.size.width = Number(wVal);
  if (hVal !== '') options.size.height = Number(hVal);
  const xlim = document.getElementById('xlimInput').value.split(',').map(s=>s.trim()).filter(Boolean);
  if (xlim.length===2) options.axis.xlim = [Number(xlim[0]), Number(xlim[1])];
  const ylim = document.getElementById('ylimInput').value.split(',').map(s=>s.trim()).filter(Boolean);
  if (ylim.length===2) options.axis.ylim = [Number(ylim[0]), Number(ylim[1])];
  options.axis.xlog = document.getElementById('xlog').checked;
  options.axis.yinvert = document.getElementById('yinvert').checked;
  
  // grid - only if show-grid is checked
  const showGrid = document.getElementById('show-grid').checked;
  options.grid = showGrid ? {enabled: document.getElementById('gridToggle').checked, color: document.getElementById('gridColor').value, alpha: Number(document.getElementById('gridAlpha').value), width:1} : {enabled:false};
  
  // legend
  options.legend = {position: document.getElementById('legendPos').value};
  
  // errorbars removed — keep disabled to avoid missing DOM refs
  options.errorbars = {enabled:false};
  
  // trendline - only if show-trendline is checked
  const showTrend = document.getElementById('show-trendline').checked;
  options.trendline = showTrend ? {
    enabled: document.getElementById('trendEnabled').checked,
    type: document.getElementById('trendType').value,
    degree: Number(document.getElementById('trendDegree').value||2),
    showEq: document.getElementById('trendShowEq').checked,
    color: document.getElementById('trendColor')?.value || '#000000',
    style: document.getElementById('trendStyle')?.value || 'dash',
    width: Number(document.getElementById('trendWidth')?.value || 2)
  } : {enabled:false};
  
  // datalabels - only if show-datalabels is checked
  const showDl = document.getElementById('show-datalabels').checked;
  options.datalabels = showDl ? {enabled: document.getElementById('datalabelsEnabled').checked, decimals: Number(document.getElementById('datalabelsDecimals').value||0)} : {enabled:false};
  
  options.dual_axis = true;
  
  // series - only if show-series is checked
  options.series = {};
  if (document.getElementById('show-series').checked){
    const seriesControls = document.querySelectorAll('.series-control');
    seriesControls.forEach(sc=>{
      const name = sc.dataset.name;
      const color = sc.querySelector('.series-color')?.value || '#000000';
      const linewidth = Number(sc.querySelector('.series-linewidth')?.value||2);
      const marker = sc.querySelector('.series-marker')?.value || 'circle';
      const markersize = Number(sc.querySelector('.series-markersize')?.value||6);
      const linestyle = sc.querySelector('.series-linestyle')?.value || 'solid';
      const show_line = sc.querySelector('.series-showline')?.checked || false;
      const show_marker = sc.querySelector('.series-showmarker')?.checked || false;
      options.series[name] = {color, linewidth, marker, markersize, linestyle, show_line, show_marker};
    });
  }
  return options;
}

// per-series controls
function attachSeriesSettingsListeners(){
  const container = document.getElementById('seriesControls');
  container.innerHTML = '';
  const displayChecks = Array.from(document.querySelectorAll('input[name="displayField"]'));
  displayChecks.forEach(cb=>{ cb.addEventListener('change', ()=>renderSeriesControls()); });
  renderSeriesControls();
}
function renderSeriesControls(){
  const container = document.getElementById('seriesControls'); container.innerHTML = '';
  const displayChecks = Array.from(document.querySelectorAll('input[name="displayField"]:checked'));
  displayChecks.forEach(cb=>{
    const name = cb.value;
    const div = document.createElement('div');
    div.className = 'series-control p-2 border rounded'; div.dataset.name = name;
    div.innerHTML = `\
      <div class="font-medium">${name}</div>\
      <div class="grid grid-cols-2 gap-2 mt-1">\
        <div>색 <input class="series-color" type="color" value="#000000" /></div>\
        <div>선너비 <input class="series-linewidth" type="number" step="0.1" value="2" /></div>\
        <div>마커 <input class="series-marker" value="circle" /></div>\
        <div>마커크기 <input class="series-markersize" type="number" step="1" value="6" /></div>\
        <div>선스타일 <select class="series-linestyle" class="border p-1 rounded"><option value="solid">실선</option><option value="dash">파선</option><option value="dot">점선</option></select></div>\
        <div><label><input class="series-showline" type="checkbox" checked/> 선</label> <label class="ml-2"><input class="series-showmarker" type="checkbox" checked/> 표식</label></div>\
      </div>`;
    container.appendChild(div);
  });
}

// Y축 라벨 UI 업데이트
function updateYAxisLabelUI(yfields){
  const container = document.getElementById('ylabels-container');
  container.innerHTML = '';
  yfields.forEach((field, idx)=>{
    const div = document.createElement('div');
    div.className = 'mb-2';
    div.innerHTML = `
      <label class="block text-sm">Y축${idx+1} 제목 (${field})</label>
      <input id="ylabel_${idx}" class="border p-1 rounded w-full mb-1 text-sm" placeholder="제목 입력" />
    `;
    container.appendChild(div);
  });
}

function updateXAxisLabelUI(x_fields){
  const container = document.getElementById('xlabels-container');
  if (!container) return;
  container.innerHTML = '';
  for (let i=0;i<Math.min(2,x_fields.length);i++){
    const div = document.createElement('div');
    div.className = 'mb-2';
    div.innerHTML = `<label class="block text-sm font-medium text-gray-700">X축 ${i+1} 제목</label><input type="text" id="xlabel_${i}" class="mt-1 block w-full border-gray-300 rounded-md" value="${x_fields[i]||''}">`;
    container.appendChild(div);
  }
}

// High-res download (removed as requested)

// 설정 반영 버튼
btnUpdate.addEventListener('click', ()=>{ btnPlot.click(); });

// collapsible toggle visibility
document.querySelectorAll('[id^="show-"]').forEach(checkbox=>{
  checkbox.addEventListener('change', (e)=>{
    const sectionName = checkbox.id.replace('show-','');
    const content = document.getElementById(sectionName+'-content');
    if (content) content.style.display = checkbox.checked ? 'block' : 'none';
  });
});

// initial attach
attachSeriesSettingsListeners();

// expose helper for debugging
window.pivotAndAggregate = pivotAndAggregate;
window.polyfit = polyfit;
window.polyval = polyval;
