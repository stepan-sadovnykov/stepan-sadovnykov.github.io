"use strict";

var cellDiameter = 10;
var density = .3;
var generationDelay = 100;

var svgField;
var _infoProvider;

var height;
var width;
var cellType;
var displacements;
var wrap;

var cellsX, semiCellsX;
var cellsY;
var cellSide;
var effectiveCellHeight;
var shape;
var getPath;
var cellRadius = cellDiameter >> 1;
var grid = [];
var timer;

var keep   = 0b0000000001100;
var create = 0b0000000001000;


const Tessellations = {
    RECT: 0,
    HEX: 1,
    TRIANGLE: 2
};

class Cell {
    constructor(x, y) {
        this.state = Math.random() < density;
        this.sum = 0;
        this.view = createCellView(svgField, x, y);
        this.view.onclick = this.cellOnClick.bind(this);
        this.neighbours = [];
    }

    updateSum() {
        var sum = 0;
        var neighbours = this.neighbours;
        var i;
        for (i = 0; i < (neighbours.length|0); i++) {
            sum += neighbours[i].state|0;
        }
        this.sum = sum;
    }

    updateState() {
        var sumMask = 1 << this.sum;
        this.state = !!(this.state ? (sumMask & keep) : (sumMask & create));
    }

    updateCss() {
        this.view.classList.toggle("true", !!this.state);
    }

    cellOnClick() {
        this.state = !this.state;
        this.updateCss();
    }
}

function getRectanglePath(x, y) {
    x = x|0;
    y = y|0;
    var i;
    var point;
    var path = "";
    for (i = 0; i < shape.length; i++) {
        point = shape[i];
        path += (point[0] + x * cellDiameter) + "," + (point[1] + y * effectiveCellHeight) + " ";
    }
    return path;
}

function getHexagonPath(x, y) {
    x = x|0;
    y = y|0;
    var i;
    var point;
    var effectiveX = ((x << 1) + y) % semiCellsX;
    var offsetX = effectiveX * cellRadius;
    var offsetY = y * effectiveCellHeight;
    var path = "";
    for (i = 0; i < shape.length; i++) {
        point = shape[i];
        path += (point[0] + offsetX) + "," + (point[1] + offsetY) + " ";
    }
    return path;
}

function getTrianglePath(x, y) {
    x = x|0;
    y = y|0;
    var i;
    var point;
    var path = "";
    var isOddDiagonal = (x + y) % 2;
    var direction = isOddDiagonal ? -1 : 1;
    var offsetX = x * cellDiameter + (isOddDiagonal ? cellDiameter : 0);
    var offsetY = y * effectiveCellHeight;
    for (i = 0; i < shape.length; i++) {
        point = shape[i];
        var _x = direction * point[0] + offsetX;
        path += _x + "," + (point[1] + offsetY) + " ";
    }
    return path;
}

function createCellView(field, x, y) {
    x = x|0;
    y = y|0;

    var svgUri = "http://www.w3.org/2000/svg";
    var item;
    item = document.createElementNS(svgUri, "polygon");
    item.setAttribute("points", getPath(x, y));
    field.appendChild(item);
    return item;
}

function mod(a, b) {
    return ((a % b) + b) % b;
}

const Neighbourhoods ={
    RECT_NEUMANN: [
                      [ 0, -1],
            [-1,  0],           [ 1,  0],
                      [ 0,  1]
        ],
    TRI_NEUMANN: [
                      [ 0, -1],
            [-1,  0],
                      [ 0, -1]
    ],
    RECT_MOORE: [
            [-1, -1], [ 0, -1], [ 1, -1],
            [-1,  0],           [ 1,  0],
            [-1,  1], [ 0,  1], [ 1,  1]
        ],
    TRI_MOORE: [
            [-1, -2], [ 0, -2],
            [-1, -1], [ 0, -1], [ 1, -1],
            [-1,  0],           [ 1,  0],
            [-1,  1], [ 0,  1], [ 1,  1],
            [-1,  2], [ 0,  2]
    ],
    HEX: [
                      [ 0, -1], [ 1, -1],
            [-1,  0],           [ 1,  0],
            [-1,  1], [ 0,  1]
        ]
};

var getNeighbours = function(grid, x, y) {
    x = x|0;
    y = y|0;
    var result = [];
    var isOddDiagonal = (x + y) % 2;
    var isTriangular = cellType == Tessellations.TRIANGLE;
    var reflected = isOddDiagonal && isTriangular;
    var i;
    var d;
    for (i = 0; i < displacements.length; i++) {
        d = displacements[i];
        var _x = mod(x + (reflected ? -1 : 1) * d[0], cellsX);
        var _y = mod(y + d[1], cellsY);
        if (!wrap && (_x != x + d[0] || _y != y + d[1]))
            continue;
        result.push(grid[_x][_y]);
    }
    return result;
};

function initGrid() {
    var x, y;
    for (x = 0; x < cellsX; x++) {
        grid[x] = [];
        for (y = 0; y < cellsY; y++) {
            grid[x][y] = new Cell(x, y);
        }
    }
}

function initNeighbours() {
    var x, y;
    for (x = 0; x < cellsX; x++) {
        for (y = 0; y < cellsY; y++) {
            grid[x][y].neighbours = getNeighbours(grid, x, y);
        }
    }
}

var paused = false;
function update() {
    if (paused) return;
    var x, y;
    for (x = 0; x < cellsX; x++) {
        for (y = 0; y < cellsY; y++) {
            grid[x][y].updateSum();
        }
    }
    for (x = 0; x < cellsX; x++) {
        for (y = 0; y < cellsY; y++) {
            grid[x][y].updateState();
        }
    }
    for (x = 0; x < cellsX; x++) {
        for (y = 0; y < cellsY; y++) {
            grid[x][y].updateCss();
        }
    }
}

function startTimer() {
    timer = setInterval(update, generationDelay);
}

function togglePause() {
    paused = !paused;
}

function stopTimer() {
    clearInterval(timer);
}

function destroyNeighbours() {
    var x, y;
    for (x = 0; x < cellsX; x++) {
        for (y = 0; y < cellsY; y++) {
            grid[x][y].neighbours = undefined;
        }
    }
}

function destroyGrid() {
    var x, y;
    for (x = 0; x < cellsX; x++) {
        for (y = 0; y < cellsY; y++) {
            grid[x][y].view.remove();
            grid[x][y] = undefined;
        }
        grid[x] = undefined;
    }
    grid = [];
}

function destroy() {
    stopTimer();
    destroyNeighbours();
    destroyGrid();
}

function restart() {
    destroy();
    _start();
}

function start(field, infoProvider) {
    svgField = field;
    _infoProvider = infoProvider;
    _start();
}

function _start() {
    height = _infoProvider.getHeight();
    width = _infoProvider.getWidth();
    cellType = _infoProvider.getCellType();
    displacements = _infoProvider.getNeighbourDisplacements();
    wrap = _infoProvider.getEdgeWrapping();

    switch (cellType) {
        case Tessellations.RECT:
            effectiveCellHeight = cellDiameter|0;
            shape = [
                [0, 0],
                [cellDiameter, 0],
                [cellDiameter, effectiveCellHeight],
                [0, effectiveCellHeight]
            ];
            getPath = getRectanglePath;
            break;
        case Tessellations.HEX:
            cellSide = cellRadius / Math.sin(Math.PI / 3);
            effectiveCellHeight = (cellSide * 3 / 2)|0;
            shape = [
                [cellRadius, 0],
                [cellDiameter, cellSide / 2],
                [cellDiameter, effectiveCellHeight],
                [cellRadius, cellSide * 2],
                [0, effectiveCellHeight],
                [0, cellSide / 2]
            ];
            getPath = getHexagonPath;
            break;
        case Tessellations.TRIANGLE:
            effectiveCellHeight = (cellDiameter / Math.tan(Math.PI / 3))|0;
            shape = [
                [0, 0],
                [cellDiameter, effectiveCellHeight],
                [0, effectiveCellHeight * 2]
            ];
            getPath = getTrianglePath;
            break;
    }

    cellsX = (Math.floor(width / cellDiameter) - 1)|0;
    semiCellsX = cellsX << 1;
    cellsY = (Math.floor(height / effectiveCellHeight) - 1)|0;

    svgField.setAttribute("height", height + "px");
    svgField.setAttribute("width", width + "px");

    initGrid();
    initNeighbours();
    startTimer();
}

function createEmptyInfoProvider() {
    var infoProvider = {};
    infoProvider.getHeight = function() {return 100;};
    infoProvider.getWidth = function() {return 100;};
    infoProvider.getEdgeWrapping = function() {return true;};
    infoProvider.getCellType = function() {return Tessellations.HEX;};
    infoProvider.getNeighbourDisplacements = function() {return Neighbourhoods.HEX;};
    return infoProvider;
}