const fs = require('fs');
const path = require('path');
const targetFile = path.resolve(__dirname, 'node_modules/@mai-kit/draw/dist/index.js');
let code = fs.readFileSync(targetFile, 'utf8');

// The exact source strings to replace to avoid regex issues.
const origFuncSrc = `function constantDistributionFromCharts(charts) {
  const buckets = Array.from({ length: 16 }, () => 0);
  for (const chart of charts) {
    const levelValue = chart.level_value ?? parseLevelString(chart.level);
    if (levelValue === void 0)
      throw new DrawError(\`Score \${chart.id} is missing a parseable level\`);
    const index = clamp(Math.floor((levelValue - 13.5) / 0.125), 0, buckets.length - 1);
    buckets[index] += 1;
  }
  return buckets;
}`;

// If exact match fails, let's use a substring match.
let startIndex = code.indexOf('function constantDistributionFromCharts(charts)');
if (startIndex === -1) { console.error('not found'); process.exit(1); }
let endIndex = code.indexOf('return buckets;\n}', startIndex);
if (endIndex === -1) { console.error('end not found'); process.exit(1); }
const origFunc = code.substring(startIndex, endIndex + 'return buckets;\n}'.length);

const newFunc = `function constantDistributionFromCharts(charts) {
  let minL = 99;
  let maxL = 0;
  for (const chart of charts) {
    const v = chart.level_value ?? parseLevelString(chart.level);
    if (v !== undefined) {
      if (v < minL) minL = v;
      if (v > maxL) maxL = v;
    }
  }
  if (minL === 99) { minL = 13.5; maxL = 15.5; }
  
  let minBase = Math.floor(minL * 2) / 2;
  let maxBase = Math.ceil(maxL * 2) / 2;
  if (maxBase - minBase < 2.0) {
     const diff = 2.0 - (maxBase - minBase);
     minBase -= Math.floor(diff * 2) / 2 / 2;
     maxBase += Math.ceil(diff * 2) / 2 / 2;
  }
  
  const bucketCount = Math.round((maxBase - minBase) / 0.1) + 1;
  const buckets = Array.from({ length: bucketCount }, () => 0);
  
  for (const chart of charts) {
    const v = chart.level_value ?? parseLevelString(chart.level);
    if (v !== undefined) {
       const index = clamp(Math.round((v - minBase) / 0.1), 0, buckets.length - 1);
       buckets[index] += 1;
    }
  }
  return { buckets, minBase, maxBase, bucketCount };
}`;

code = code.replace(origFunc, newFunc);
code = code.replace(/jsx\(BarChart, \{ values: constantDistribution \}\)/g, 'jsx(BarChart, { data: constantDistribution })');

let barChartStart = code.indexOf('function BarChart({');
let barChartEnd = code.indexOf('return /* @__PURE__ */ jsxs("div", {', barChartStart);
let barChartEnd2 = code.indexOf('  });\n}', barChartEnd);
const origBarChart = code.substring(barChartStart, barChartEnd2 + '  });\n}'.length);

const newBarChart = `function BarChart({ data }) {
    const { buckets: values, minBase, maxBase, bucketCount } = data?.buckets ? data : { buckets: data?.values || data || [], minBase: 13.5, maxBase: 15.5, bucketCount: 21 };
  	const max = Math.max(...values, 1);
    
    // dynamically space bars
    const availableWidth = 206; // 240 - 34
    const barSpacing = availableWidth / Math.max(1, bucketCount - 1);
    const barWidth = Math.max(2, Math.min(6, barSpacing * 0.7));

    // dynamic labels every 0.5
    const labels = [];
    for(let i = minBase; i <= maxBase + 0.01; i += 0.5) {
       labels.push(i.toFixed(1));
    }

  	return /* @__PURE__ */ jsxs("div", {
  		style: chartStyles.barWrap,
  		children: [
  			/* @__PURE__ */ jsxs("svg", {
  				width: "250",
  				height: "106",
  				viewBox: "0 0 250 106",
  				children: [
  					[0, 1, 2, 3].map((i) => /* @__PURE__ */ jsx("line", {
  						x1: "28", x2: "240", y1: 14 + i * 23, y2: 14 + i * 23,
  						stroke: "#d5c6f8", strokeDasharray: "4 5"
  					}, i)),
  					values.map((value, index) => {
  						const height = Math.round(value / max * 64);
  						const x = 34 + index * barSpacing;
  						return /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("rect", {
  							x, y: 84 - height, width: barWidth, height, rx: "2", fill: "#9e6df0"
  						}), /* @__PURE__ */ jsx("rect", {
  							x, y: 84 - height, width: barWidth, height: Math.min(height, Math.max(7, height * .35)), rx: "2", fill: "#f1b4ff", opacity: ".7"
  						})] }, index);
  					}),
  					/* @__PURE__ */ jsx("line", { x1: "28", x2: "240", y1: "84", y2: "84", stroke: "#b8a5e7" })
  				]
  			}),
  			labels.map((label, index) => /* @__PURE__ */ jsx("div", {
  				style: {
  					...chartStyles.axisX,
  					left: 28 + (0.5 / 0.1) * index * barSpacing
  				},
  				children: label
  			}, label)),
  			[0, 5, 10, 15].map((label, index) => /* @__PURE__ */ jsx("div", {
  				style: { ...chartStyles.axisY, top: 78 - index * 23 },
  				children: label
  			}, label))
  		]
  	});
}`;

code = code.replace(origBarChart, newBarChart);

fs.writeFileSync(targetFile, code);
console.log('Patched safely!');
