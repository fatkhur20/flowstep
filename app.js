const palette = document.getElementById("palette");
const canvas = document.getElementById("canvas");
const connectionLayer = document.getElementById("connections");
const explainPanel = document.getElementById("explainPanel");
const stepLog = document.getElementById("stepLog");
const modal = document.getElementById("modal");
const jsonArea = document.getElementById("jsonArea");
const faultPower = document.getElementById("faultPower");
const faultDrop = document.getElementById("faultDrop");
const faultOverload = document.getElementById("faultOverload");

const runBtn = document.getElementById("runBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stepBtn = document.getElementById("stepBtn");
const resetBtn = document.getElementById("resetBtn");
const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");

const toggleExplain = document.getElementById("toggleExplain");
const copyJson = document.getElementById("copyJson");
const applyJson = document.getElementById("applyJson");
const closeModal = document.getElementById("closeModal");

const NODE_TYPES = {
  power: {
    label: "Power (VCC)",
    category: "Digital Components",
    inputs: 0,
    description: "Sumber tegangan HIGH untuk logika digital.",
    compute: () => ({ value: 12, message: "Power menyediakan HIGH (12V)." })
  },
  ground: {
    label: "Ground (GND)",
    category: "Digital Components",
    inputs: 0,
    description: "Referensi LOW (0V).",
    compute: () => ({ value: 0, message: "Ground menyediakan LOW (0V)." })
  },
  button: {
    label: "Button / Switch",
    category: "Digital Components",
    inputs: 0,
    description: "Saklar untuk mengirim HIGH atau LOW.",
    compute: (node) => {
      const value = node.settings.on ? 12 : 0;
      return {
        value,
        message: `Button ${node.settings.on ? "ON" : "OFF"} menghasilkan ${value === 12 ? "HIGH" : "LOW"}.`
      };
    }
  },
  and: {
    label: "AND Gate",
    category: "Digital Components",
    inputs: 2,
    description: "Output HIGH hanya jika kedua input HIGH.",
    compute: (node, inputs) => {
      const result = inputs.every((v) => v >= 6) ? 12 : 0;
      return {
        value: result,
        message: `Output AND = ${result === 12 ? "HIGH" : "LOW"} karena input ${inputs.map((v) => (v >= 6 ? "HIGH" : "LOW")).join(" & ")}.`
      };
    }
  },
  or: {
    label: "OR Gate",
    category: "Digital Components",
    inputs: 2,
    description: "Output HIGH jika salah satu input HIGH.",
    compute: (node, inputs) => {
      const result = inputs.some((v) => v >= 6) ? 12 : 0;
      return {
        value: result,
        message: `Output OR = ${result === 12 ? "HIGH" : "LOW"} karena input ${inputs.map((v) => (v >= 6 ? "HIGH" : "LOW")).join(" / ")}.`
      };
    }
  },
  not: {
    label: "NOT Gate",
    category: "Digital Components",
    inputs: 1,
    description: "Membalik sinyal input.",
    compute: (node, inputs) => {
      const result = inputs[0] >= 6 ? 0 : 12;
      return {
        value: result,
        message: `NOT membalik input menjadi ${result === 12 ? "HIGH" : "LOW"}.`
      };
    }
  },
  xor: {
    label: "XOR Gate",
    category: "Digital Components",
    inputs: 2,
    description: "Output HIGH jika input berbeda.",
    compute: (node, inputs) => {
      const highCount = inputs.filter((v) => v >= 6).length;
      const result = highCount === 1 ? 12 : 0;
      return {
        value: result,
        message: `XOR menghasilkan ${result === 12 ? "HIGH" : "LOW"} karena input berbeda? ${highCount === 1 ? "Ya" : "Tidak"}.`
      };
    }
  },
  flipflop: {
    label: "Flip-Flop D",
    category: "Digital Components",
    inputs: 2,
    description: "Menyimpan nilai D pada tepi naik clock.",
    compute: (node, inputs) => {
      const [d, clock] = inputs;
      const rising = node.state.prevClock < 6 && clock >= 6;
      if (rising) {
        node.state.q = d >= 6 ? 12 : 0;
      }
      node.state.prevClock = clock;
      return {
        value: node.state.q,
        message: rising
          ? `Flip-Flop mengambil D=${d >= 6 ? "HIGH" : "LOW"} saat clock naik.`
          : "Flip-Flop menahan nilai sebelumnya."
      };
    }
  },
  clock: {
    label: "Clock",
    category: "Digital Components",
    inputs: 0,
    description: "Sinyal pulsa periodik.",
    tick: true,
    compute: (node) => {
      node.state.ticks = (node.state.ticks ?? 0) + 1;
      const value = node.state.ticks % 2 === 0 ? 12 : 0;
      return {
        value,
        message: `Clock pada fase ${value === 12 ? "HIGH" : "LOW"}.`
      };
    }
  },
  counter: {
    label: "Counter",
    category: "Digital Components",
    inputs: 1,
    description: "Menghitung pulsa clock secara sederhana.",
    compute: (node, inputs) => {
      const clock = inputs[0];
      const rising = node.state.prevClock < 6 && clock >= 6;
      if (rising) {
        node.state.count = (node.state.count + 1) % 16;
      }
      node.state.prevClock = clock;
      const value = (node.state.count / 15) * 12;
      return {
        value,
        message: `Counter bernilai ${node.state.count}.`
      };
    }
  },
  ledDigital: {
    label: "LED (ON/OFF)",
    category: "Digital Components",
    inputs: 1,
    description: "LED menyala bila input HIGH.",
    compute: (node, inputs) => {
      const value = inputs[0] >= 6 ? 12 : 0;
      return {
        value,
        message: `LED digital ${value === 12 ? "menyala" : "mati"}.`
      };
    }
  },
  voltage: {
    label: "Voltage Source",
    category: "Semi-Analog",
    inputs: 0,
    description: "Sumber tegangan 0-12V.",
    compute: (node) => ({
      value: node.settings.level,
      message: `Voltage Source pada ${node.settings.level.toFixed(1)}V.`
    })
  },
  resistor: {
    label: "Resistor",
    category: "Semi-Analog",
    inputs: 1,
    description: "Menurunkan tegangan secara sederhana.",
    compute: (node, inputs) => {
      const dropFactor = Math.min(0.9, node.settings.resistance / 10000);
      const value = inputs[0] * (1 - dropFactor);
      return {
        value,
        message: `Resistor menurunkan tegangan menjadi ${value.toFixed(1)}V.`
      };
    }
  },
  comparator: {
    label: "Comparator",
    category: "Semi-Analog",
    inputs: 2,
    description: "Membandingkan V+ dan V-.",
    compute: (node, inputs) => {
      const result = inputs[0] > inputs[1] ? 12 : 0;
      return {
        value: result,
        message: `Comparator ${result === 12 ? "HIGH" : "LOW"} karena V+ ${inputs[0].toFixed(1)}V ${inputs[0] > inputs[1] ? ">" : "<="} V- ${inputs[1].toFixed(1)}V.`
      };
    }
  },
  delay: {
    label: "Delay / Timer",
    category: "Semi-Analog",
    inputs: 1,
    description: "Menunda perubahan sinyal secara sederhana.",
    tick: true,
    compute: (node, inputs) => {
      const input = inputs[0];
      if (node.state.queue.length === 0) {
        node.state.queue.push({ value: input, remaining: node.settings.delay });
      } else if (node.state.queue[node.state.queue.length - 1].value !== input) {
        node.state.queue.push({ value: input, remaining: node.settings.delay });
      }
      node.state.queue.forEach((item) => (item.remaining -= 1));
      if (node.state.queue.length && node.state.queue[0].remaining <= 0) {
        node.state.output = node.state.queue.shift().value;
      }
      return {
        value: node.state.output,
        message: `Delay mengeluarkan ${node.state.output.toFixed(1)}V setelah ${node.settings.delay} langkah.`
      };
    }
  },
  ledAnalog: {
    label: "LED (Brightness)",
    category: "Semi-Analog",
    inputs: 1,
    description: "LED dengan tingkat kecerahan berdasarkan tegangan.",
    compute: (node, inputs) => {
      const value = Math.min(12, Math.max(0, inputs[0]));
      return {
        value,
        message: `LED analog berada di ${(value / 12 * 100).toFixed(0)}% terang.`
      };
    }
  },
  temp: {
    label: "Temperature Sensor",
    category: "Sensor",
    inputs: 0,
    description: "Sensor suhu dengan slider.",
    compute: (node) => {
      const value = (node.settings.temp / 100) * 12;
      return {
        value,
        message: `Suhu ${node.settings.temp}°C menghasilkan ${value.toFixed(1)}V.`
      };
    }
  },
  ldr: {
    label: "LDR",
    category: "Sensor",
    inputs: 0,
    description: "Sensor cahaya gelap-terang.",
    compute: (node) => {
      const value = (node.settings.light / 100) * 12;
      return {
        value,
        message: `LDR pada ${node.settings.light}% terang menghasilkan ${value.toFixed(1)}V.`
      };
    }
  },
  pot: {
    label: "Potentiometer",
    category: "Sensor",
    inputs: 0,
    description: "Potensiometer sebagai pembagi tegangan.",
    compute: (node) => {
      const value = (node.settings.level / 100) * 12;
      return {
        value,
        message: `Potensiometer di ${node.settings.level}% menghasilkan ${value.toFixed(1)}V.`
      };
    }
  }
};

const state = {
  nodes: [],
  connections: [],
  running: false,
  explainMode: true,
  selectedOutput: null,
  selectedConnection: null,
  tickInterval: null
};

const GRID_SIZE = 10;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createNode(type, x = 60, y = 60) {
  const id = `node-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const config = NODE_TYPES[type];
  const node = {
    id,
    type,
    x,
    y,
    inputs: new Array(config.inputs).fill(0),
    output: 0,
    settings: getDefaultSettings(type),
    state: {
      prevClock: 0,
      q: 0,
      count: 0,
      ticks: 0,
      queue: [],
      output: 0
    }
  };
  state.nodes.push(node);
  renderNode(node);
  return node;
}

function getDefaultSettings(type) {
  switch (type) {
    case "button":
      return { on: false };
    case "voltage":
      return { level: 6 };
    case "resistor":
      return { resistance: 1000 };
    case "delay":
      return { delay: 2 };
    case "temp":
      return { temp: 25 };
    case "ldr":
      return { light: 50 };
    case "pot":
      return { level: 50 };
    default:
      return {};
  }
}

function renderPalette() {
  const grouped = Object.entries(NODE_TYPES).reduce((acc, [key, val]) => {
    acc[val.category] = acc[val.category] || [];
    acc[val.category].push({ key, val });
    return acc;
  }, {});

  palette.innerHTML = "";
  Object.entries(grouped).forEach(([category, items]) => {
    const heading = document.createElement("div");
    heading.className = "palette-heading";
    heading.textContent = category;
    heading.style.marginTop = "8px";
    heading.style.color = "var(--muted)";
    palette.appendChild(heading);

    items.forEach(({ key, val }) => {
      const item = document.createElement("div");
      item.className = "palette-item";
      item.textContent = val.label;
      item.addEventListener("click", () => createNode(key, 80, 80));
      palette.appendChild(item);
    });
  });
}

function renderNode(node) {
  const element = document.createElement("div");
  element.className = "node";
  element.dataset.id = node.id;
  element.style.left = `${node.x}px`;
  element.style.top = `${node.y}px`;

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = NODE_TYPES[node.type].label;

  const subtitle = document.createElement("div");
  subtitle.className = "subtitle";
  subtitle.textContent = NODE_TYPES[node.type].category;

  const status = document.createElement("div");
  status.className = "status";
  status.textContent = "Output: 0V";

  const warning = document.createElement("div");
  warning.className = "warning-text";
  warning.innerHTML = "<span class=\"warning-icon\">⚠️</span> Input belum lengkap";

  const ports = document.createElement("div");
  ports.className = "ports";

  const inputContainer = document.createElement("div");
  inputContainer.style.display = "flex";
  inputContainer.style.gap = "4px";

  for (let i = 0; i < node.inputs.length; i += 1) {
    const port = document.createElement("div");
    port.className = "port input";
    port.dataset.node = node.id;
    port.dataset.port = i;
    port.addEventListener("click", (event) => handleInputPort(event, node, i));
    inputContainer.appendChild(port);
  }

  const outputPort = document.createElement("div");
  outputPort.className = "port output";
  outputPort.dataset.node = node.id;
  outputPort.addEventListener("click", (event) => handleOutputPort(event, node));

  ports.appendChild(inputContainer);
  ports.appendChild(outputPort);

  element.appendChild(title);
  element.appendChild(subtitle);
  element.appendChild(status);
  element.appendChild(warning);
  element.appendChild(ports);

  element.addEventListener("pointerdown", (event) => startDrag(event, node, element));
  element.addEventListener("click", (event) => {
    event.stopPropagation();
    showExplain(node);
  });

  if (node.type === "button") {
    const toggle = document.createElement("button");
    toggle.textContent = "Toggle";
    toggle.style.marginTop = "6px";
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      node.settings.on = !node.settings.on;
      runStep();
    });
    element.appendChild(toggle);
  }

  if (["voltage", "temp", "ldr", "pot", "delay", "resistor"].includes(node.type)) {
    const slider = document.createElement("input");
    slider.type = "range";
    slider.style.width = "100%";
    slider.style.marginTop = "6px";

    if (node.type === "voltage") {
      slider.min = 0;
      slider.max = 12;
      slider.step = 0.5;
      slider.value = node.settings.level;
      slider.addEventListener("input", () => {
        node.settings.level = Number(slider.value);
        runStep();
      });
    }

    if (node.type === "temp") {
      slider.min = 0;
      slider.max = 100;
      slider.value = node.settings.temp;
      slider.addEventListener("input", () => {
        node.settings.temp = Number(slider.value);
        runStep();
      });
    }

    if (node.type === "ldr") {
      slider.min = 0;
      slider.max = 100;
      slider.value = node.settings.light;
      slider.addEventListener("input", () => {
        node.settings.light = Number(slider.value);
        runStep();
      });
    }

    if (node.type === "pot") {
      slider.min = 0;
      slider.max = 100;
      slider.value = node.settings.level;
      slider.addEventListener("input", () => {
        node.settings.level = Number(slider.value);
        runStep();
      });
    }

    if (node.type === "delay") {
      slider.min = 1;
      slider.max = 5;
      slider.step = 1;
      slider.value = node.settings.delay;
      slider.addEventListener("input", () => {
        node.settings.delay = Number(slider.value);
        runStep();
      });
    }

    if (node.type === "resistor") {
      slider.min = 100;
      slider.max = 5000;
      slider.step = 100;
      slider.value = node.settings.resistance;
      slider.addEventListener("input", () => {
        node.settings.resistance = Number(slider.value);
        runStep();
      });
    }

    element.appendChild(slider);
  }

  if (["ledDigital", "ledAnalog"].includes(node.type)) {
    const indicator = document.createElement("div");
    indicator.className = "led-indicator";
    indicator.dataset.node = node.id;
    element.appendChild(indicator);
  }

  canvas.appendChild(element);
}

function startDrag(event, node, element) {
  if (event.target.classList.contains("port")) return;
  event.preventDefault();
  element.setPointerCapture(event.pointerId);
  const offsetX = event.clientX - node.x;
  const offsetY = event.clientY - node.y;

  function onMove(moveEvent) {
    const nextX = clamp(moveEvent.clientX - offsetX, 0, canvas.clientWidth - 150);
    const nextY = clamp(moveEvent.clientY - offsetY, 0, canvas.clientHeight - 80);
    node.x = Math.round(nextX / GRID_SIZE) * GRID_SIZE;
    node.y = Math.round(nextY / GRID_SIZE) * GRID_SIZE;
    element.style.left = `${node.x}px`;
    element.style.top = `${node.y}px`;
    drawConnections();
  }

  function onUp(upEvent) {
    element.releasePointerCapture(upEvent.pointerId);
    element.removeEventListener("pointermove", onMove);
    element.removeEventListener("pointerup", onUp);
    element.removeEventListener("pointercancel", onUp);
  }

  element.addEventListener("pointermove", onMove);
  element.addEventListener("pointerup", onUp);
  element.addEventListener("pointercancel", onUp);
}

function handleOutputPort(event, node) {
  event.stopPropagation();
  state.selectedOutput = node;
  document.querySelectorAll(".port.output").forEach((port) => {
    port.classList.remove("active");
  });
  event.target.classList.add("active");
}

function handleInputPort(event, node, inputIndex) {
  event.stopPropagation();
  if (!state.selectedOutput) return;
  const id = `conn-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  state.connections.push({
    id,
    from: state.selectedOutput.id,
    to: node.id,
    inputIndex,
    broken: false
  });
  state.selectedOutput = null;
  document.querySelectorAll(".port.output").forEach((port) => {
    port.classList.remove("active");
  });
  drawConnections();
  runStep();
}

function showExplain(node) {
  if (!state.explainMode) return;
  const config = NODE_TYPES[node.type];
  explainPanel.innerHTML = `
    <strong>${config.label}</strong><br/>
    <em>${config.category}</em><br/>
    ${config.description}
  `;
}

function drawConnections() {
  connectionLayer.innerHTML = "";
  state.connections.forEach((conn) => {
    const fromNode = state.nodes.find((node) => node.id === conn.from);
    const toNode = state.nodes.find((node) => node.id === conn.to);
    if (!fromNode || !toNode) return;

    const fromElement = document.querySelector(`.node[data-id='${fromNode.id}']`);
    const toElement = document.querySelector(`.node[data-id='${toNode.id}']`);
    if (!fromElement || !toElement) return;

    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    const startX = fromRect.right - canvasRect.left - 6;
    const startY = fromRect.top - canvasRect.top + fromRect.height / 2;
    const endX = toRect.left - canvasRect.left + 6;
    const endY = toRect.top - canvasRect.top + toRect.height / 2;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const d = `M ${startX} ${startY} C ${startX + 80} ${startY}, ${endX - 80} ${endY}, ${endX} ${endY}`;
    path.setAttribute("d", d);
    path.classList.add("connection");
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    const signalLabel = conn.broken ? "BROKEN" : fromNode.output >= 6 ? "HIGH" : "LOW";
    title.textContent = `Signal: ${signalLabel} | ${fromNode.output.toFixed(1)}V`;
    path.appendChild(title);
    if (conn.broken) {
      path.classList.add("broken");
    }
    path.addEventListener("click", () => selectConnection(conn));
    connectionLayer.appendChild(path);
  });
}

function selectConnection(conn) {
  state.selectedConnection = conn;
  explainPanel.innerHTML = `
    <strong>Connection</strong><br/>
    Status: ${conn.broken ? "Terputus" : "Normal"}<br/>
    <button id="toggleBreak">Toggle Break</button>
  `;
  document.getElementById("toggleBreak").addEventListener("click", () => {
    conn.broken = !conn.broken;
    drawConnections();
    runStep();
  });
}

function getInputValues(node) {
  const inputs = new Array(node.inputs.length).fill(0);
  state.connections.forEach((conn) => {
    if (conn.to === node.id) {
      const source = state.nodes.find((n) => n.id === conn.from);
      if (!source) return;
      const value = conn.broken ? 0 : source.output;
      inputs[conn.inputIndex] = value;
    }
  });
  return inputs;
}

function getDownstreamMap() {
  const map = new Map();
  state.connections.forEach((conn) => {
    if (!map.has(conn.from)) {
      map.set(conn.from, new Set());
    }
    map.get(conn.from).add(conn.to);
  });
  return map;
}

function updatePortIndicators(node, inputs) {
  const nodeElement = document.querySelector(`.node[data-id='${node.id}']`);
  if (!nodeElement) return;
  inputs.forEach((value, index) => {
    const port = nodeElement.querySelector(`.port.input[data-port='${index}']`);
    if (!port) return;
    if (value >= 6) {
      port.classList.add("active");
    } else {
      port.classList.remove("active");
    }
  });
}

function updateNodeStatus(node, warningText = "") {
  const nodeElement = document.querySelector(`.node[data-id='${node.id}']`);
  if (!nodeElement) return;
  const status = nodeElement.querySelector(".status");
  const warning = nodeElement.querySelector(".warning-text");
  status.textContent = `Output: ${node.output.toFixed(1)}V`;
  if (warningText) {
    warning.innerHTML = `<span class="warning-icon">⚠️</span> ${warningText}`;
    warning.classList.add("show");
    nodeElement.classList.add("warning");
  } else {
    warning.classList.remove("show");
    nodeElement.classList.remove("warning");
  }
}

function applyFaults(value) {
  let adjusted = value;
  if (faultPower.checked) {
    adjusted = 0;
  }
  if (faultDrop.checked) {
    adjusted *= 0.6;
  }
  if (faultOverload.checked) {
    adjusted *= 0.3;
  }
  return adjusted;
}

function runStep() {
  stepLog.innerHTML = "";
  const changedMessages = [];
  const downstreamMap = getDownstreamMap();
  const dirtyQueue = [];
  const dirtySet = new Set();

  state.nodes.forEach((node) => {
    const inputs = getInputValues(node);
    node.state.prevInputs = node.state.prevInputs || new Array(inputs.length).fill(0);
    const inputChanged = inputs.some((value, index) => value !== node.state.prevInputs[index]);
    node.state.prevInputs = inputs;

    updatePortIndicators(node, inputs);

    const config = NODE_TYPES[node.type];
    if (config.inputs === 0 || config.tick || inputChanged) {
      if (!dirtySet.has(node.id)) {
        dirtyQueue.push({ node, inputs });
        dirtySet.add(node.id);
      }
    }

    const missingInputs = inputs.filter((value, index) => {
      const hasConnection = state.connections.some((conn) => conn.to === node.id && conn.inputIndex === index);
      return !hasConnection;
    });
    if (!dirtySet.has(node.id)) {
      updateNodeStatus(node, missingInputs.length ? "Input belum lengkap" : "");
    }
  });

  while (dirtyQueue.length) {
    const { node, inputs } = dirtyQueue.shift();
    const config = NODE_TYPES[node.type];
    const latestInputs = inputs ?? getInputValues(node);
    const result = config.compute(node, latestInputs);
    const adjustedValue = applyFaults(result.value);
    const outputChanged = node.output !== adjustedValue;

    node.output = adjustedValue;

    if (outputChanged) {
      const line = document.createElement("div");
      line.textContent = result.message;
      changedMessages.push(line);
      const downstream = downstreamMap.get(node.id);
      if (downstream) {
        downstream.forEach((nextId) => {
          if (!dirtySet.has(nextId)) {
            const nextNode = state.nodes.find((n) => n.id === nextId);
            if (nextNode) {
              dirtyQueue.push({ node: nextNode, inputs: getInputValues(nextNode) });
              dirtySet.add(nextId);
            }
          }
        });
      }
    }

    const missingInputs = latestInputs.filter((value, index) => {
      const hasConnection = state.connections.some((conn) => conn.to === node.id && conn.inputIndex === index);
      return !hasConnection;
    });
    const warningText = missingInputs.length ? "Input belum lengkap" : "";
    updateNodeStatus(node, warningText);
    updateLedIndicator(node);
  }

  if (changedMessages.length === 0) {
    const line = document.createElement("div");
    line.textContent = "Tidak ada perubahan signifikan pada step ini.";
    changedMessages.push(line);
  }

  changedMessages.forEach((line) => stepLog.appendChild(line));
  updateConnectionStyles();
}

function updateLedIndicator(node) {
  if (!["ledDigital", "ledAnalog"].includes(node.type)) return;
  const indicator = document.querySelector(`.led-indicator[data-node='${node.id}']`);
  if (!indicator) return;
  const intensity = node.type === "ledDigital" ? (node.output >= 6 ? 1 : 0.2) : node.output / 12;
  indicator.style.opacity = intensity.toFixed(2);
  indicator.style.boxShadow = `0 0 ${6 + intensity * 10}px rgba(247, 37, 133, ${0.3 + intensity * 0.6})`;
}

function updateConnectionStyles() {
  const paths = connectionLayer.querySelectorAll("path");
  state.connections.forEach((conn, index) => {
    const path = paths[index];
    if (!path) return;
    const source = state.nodes.find((node) => node.id === conn.from);
    if (!source) return;
    path.classList.remove("active", "low");
    const title = path.querySelector("title");
    const signalLabel = conn.broken ? "BROKEN" : source.output >= 6 ? "HIGH" : "LOW";
    if (title) {
      title.textContent = `Signal: ${signalLabel} | ${source.output.toFixed(1)}V`;
    }
    if (conn.broken) return;
    if (source.output >= 6) {
      path.classList.add("active");
    } else {
      path.classList.add("low");
    }
  });
}

function startRun() {
  if (state.running) return;
  state.running = true;
  state.tickInterval = setInterval(runStep, 600);
}

function pauseRun() {
  state.running = false;
  if (state.tickInterval) {
    clearInterval(state.tickInterval);
    state.tickInterval = null;
  }
}

function resetAll() {
  pauseRun();
  state.nodes.forEach((node) => {
    node.output = 0;
    node.state = { prevClock: 0, q: 0, count: 0, ticks: 0, queue: [], output: 0, prevInputs: null };
  });
  runStep();
}

function saveJson() {
  jsonArea.value = JSON.stringify({ nodes: state.nodes, connections: state.connections }, null, 2);
  modal.classList.remove("hidden");
}

function loadJson() {
  jsonArea.value = "";
  modal.classList.remove("hidden");
}

function applyJsonData() {
  try {
    const data = JSON.parse(jsonArea.value);
    state.nodes = [];
    state.connections = [];
    canvas.querySelectorAll(".node").forEach((node) => node.remove());
    data.nodes.forEach((node) => {
      state.nodes.push({ ...node });
      renderNode(node);
    });
    state.connections = data.connections || [];
    drawConnections();
    runStep();
    modal.classList.add("hidden");
  } catch (error) {
    alert("JSON tidak valid.");
  }
}

canvas.addEventListener("click", () => {
  if (state.selectedOutput) {
    state.selectedOutput = null;
    document.querySelectorAll(".port.output").forEach((port) => {
      port.classList.remove("active");
    });
  }
});

runBtn.addEventListener("click", startRun);
pauseBtn.addEventListener("click", pauseRun);
stepBtn.addEventListener("click", runStep);
resetBtn.addEventListener("click", resetAll);
saveBtn.addEventListener("click", saveJson);
loadBtn.addEventListener("click", loadJson);

copyJson.addEventListener("click", () => {
  jsonArea.select();
  document.execCommand("copy");
});

applyJson.addEventListener("click", applyJsonData);
closeModal.addEventListener("click", () => modal.classList.add("hidden"));

toggleExplain.addEventListener("click", () => {
  state.explainMode = !state.explainMode;
  toggleExplain.textContent = state.explainMode ? "Explain Mode: ON" : "Explain Mode: OFF";
});

toggleExplain.textContent = state.explainMode ? "Explain Mode: ON" : "Explain Mode: OFF";

renderPalette();
runStep();

window.addEventListener("resize", drawConnections);
