

const settings = {
  algorithm: "selection",
  range: {
    low: 1,
    high: 40,
  },
  speed: 30,
  start: false,
};
const compares = document.getElementById("compares");
let lines = [];
let audioCtx = null;

const randomArrayInRange = ([bottom = 1, top = 100]) => {
  let arr = [];
  for (let i = bottom; i < top; i++) arr.push(i);
  return arr.sort((a, b) => (Math.random() > 0.5 ? 1 : -1));
};

const arr = randomArrayInRange([settings.range.low, settings.range.high]);

const calcLineWidth = () => {
  return (
    Math.floor(innerWidth / (settings.range.high - settings.range.low)) - 0.8
  );
};
const calcLineHeightMulti = () => {
  for (let i = 20; i > 0; i -= 0.25) {
    if (settings.range.high * i < innerHeight - 25) {
      return i;
    }
  }
  return 0.5;
};

const lineWidth = calcLineWidth();
const initLines = () => {
  lines = [];
  arr.forEach((v, i) => {
    lines.push(
      new Line(
        lineWidth * i + i,
        0,
        lineWidth,
        v * calcLineHeightMulti(),
        this.color
      )
    );
  });
};

initLines();
let timers = [];

const canvas = document.getElementById("my-c");
canvas.width = innerWidth;
canvas.height = innerHeight;
/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext("2d");

let notCalledYet = true;

Array.from(document.getElementsByTagName("button")).forEach((btn) => {
  btn.onclick = () => {
    settings.algorithm = btn.value;
    if (!notCalledYet) {
      // reset canvas state
      timers.forEach((id) => clearTimeout(id));
      timers = [];
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      initLines();
      compares.innerText = "";
    }
    animate();
    notCalledYet = false;
  };
});

// Web Audio API integration
function playSound(type, frequency, duration) {
  if (!audioCtx) {
    audioCtx = new (AudioContext || webkitAudioContext || window.webkitAudioContext)();
  }

  const osc = audioCtx.createOscillator();
  osc.frequency.value = frequency;
  osc.type = type;
  osc.start();
  osc.stop(audioCtx.currentTime + duration);

  const gain = audioCtx.createGain();
  gain.gain.value = 0.4;
  gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
}

const ACTIONS = {
  swap: (i, j) => ({ type: "swap", index: [i, j] }),
  sorted: (i) => ({ type: "sorted", index: i }),
  comparing: (i, j) => ({ type: "comparing", index: [i, j] }),
  pivot: (i) => ({ type: "pivot", index: i }),
};

function Line(x, y, width, height, color = "gray") {
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height;
  this.color = color;

  this.draw = () => {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  };

  this.resetColor = () => (this.color = "gray");

  this.isSorted = () => this.color === "green";
  this.setValue = (v, color) => {
    if (!this.isSorted()) {
      this.height = v;
      this.color = color;
    }
  };
  this.getValue = () => this.height;
}

const quickSortActions = (array) => {
  const actions = [];
  function swap(items, firstIndex, secondIndex) {
    actions.push(ACTIONS.swap(firstIndex, secondIndex));
    let temp = items[firstIndex];
    items[firstIndex] = items[secondIndex];
    items[secondIndex] = temp;
  }

  function partition(items, left, right) {
    const pivotIndex = Math.floor((right + left) / 2);
    let pivot = items[pivotIndex];
    let i = left;
    let j = right;

    while (i <= j) {
      while (items[i] < pivot) {
        i++;
        actions.push(ACTIONS.comparing(pivotIndex, i));
      }

      while (items[j] > pivot) {
        j--;
        actions.push(ACTIONS.comparing(pivotIndex, j));
      }

      if (i <= j) {
        swap(items, i, j);
        i++;
        j--;
      }
    }

    return i;
  }

  function quickSort(items, left, right) {
    let index;

    if (items.length > 1) {
      left = typeof left !== "number" ? 0 : left;
      right = typeof right !== "number" ? items.length - 1 : right;

      index = partition(items, left, right);
      actions.push(ACTIONS.pivot(index));
      if (left < index - 1) {
        quickSort(items, left, index - 1);
      }

      if (index < right) {
        quickSort(items, index, right);
      }
    }
    actions.push(ACTIONS.sorted(index));

    return items;
  }
  quickSort([...array]);
  actions.push(ACTIONS.sorted(0));

  return actions;
};

const uniques = (a) => Array.from(new Set([...a]));

const bubbleSort = ([...array]) => {
  let actions = [];
  for (let i = 0; i < array.length; i++) {
    for (let j = 0; j < array.length - 1; j++) {
      actions.push(ACTIONS.comparing(j, j + 1));
      if (array[j] > array[j + 1]) {
        let tmp = array[j];
        array[j] = array[j + 1];
        array[j + 1] = tmp;
        actions.push(ACTIONS.swap(j, j + 1));
      }
    }
    actions.push(ACTIONS.sorted(array.length - i - 1));
  }
  return actions;
};

function selectionSort([...arr]) {
  const actions = [];

  for (let i = 0; i < arr.length; i++) {
    let min = i;

    for (let j = i + 1; j < arr.length; j++) {
      actions.push(ACTIONS.comparing(min, j));
      if (arr[min] > arr[j]) {
        min = j;
      }
    }
    actions.push(ACTIONS.comparing(i, min));
    if (i !== min) {
      let temp = arr[i];
      actions.push(ACTIONS.swap(i, min));

      arr[i] = arr[min];
      arr[min] = temp;
    }
    actions.push(ACTIONS.sorted(i));
  }
  return actions;
}

const isSorted = (arr, i) => arr[i].color === "green";

const actionsMap = {
  sorted: (action) => {
    const i = action.index;
    lines[i].color = "green";
    playSound("sine", 440, 0.1); // Frequency 440Hz for sorted
  },
  swap: (action) => {
    const [i, j] = action.index;
    let tmp = lines[i].getValue();
    lines[i].setValue(lines[j].getValue(), "red");
    lines[j].setValue(tmp, "yellow");
    playSound("square", 550, 0.1); // Frequency 550Hz for swap
  },
  comparing: (action) => {
    const [i, j] = action.index;
    compares.innerText = 1 + Number(compares.innerText);
    if (lines[i].color !== "green" && lines[i].color !== "#1DF3FD")
      lines[i].color = "blue";
    if (lines[j].color !== "green" && lines[j].color !== "#1DF3FD")
      lines[j].color = "blue";
    playSound("sine", 330, 0.1); // Frequency 330Hz for comparing
  },
  pivot: (action) => {
    const i = action.index;
    lines[i].color = "#1DF3FD";
    playSound("triangle", 660, 0.1); // Frequency 660Hz for pivot
  },
};

const resetSpecifiedColor = (color) =>
  lines.forEach(
    (l) => (l.color === color || l.color === "blue") && l.resetColor()
  );

const sortingStates = {
  bubble: () => bubbleSort(arr),
  selection: () => selectionSort(arr),
  quickSort: () => quickSortActions(uniques(arr)),
};

function animate() {
  sortingStates[settings.algorithm]().forEach((action, i) => {
    timers.push(
      setTimeout(() => {
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        actionsMap[action.type](action);
        lines.forEach((l) => l.draw());
        resetSpecifiedColor("yellow");
        resetSpecifiedColor("red");
      }, settings.speed * i)
    );
  });
}
