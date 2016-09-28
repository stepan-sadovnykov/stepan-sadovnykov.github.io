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

var cellsX;
var cellsY;
var cellSide;
var effectiveCellHeight;
var cellRadius = cellDiameter / 2;
var grid = [];
var timer;

const Tessellations = {
    RECT: 0,
    HEX: 1,
    TRIANGLE: 2
};

function createCellView(field, x, y) {
    var svgUri = "http://www.w3.org/2000/svg";
    var effectiveX;
    var item;
    var points;
    var path = "";
    var point;
    item = document.createElementNS(svgUri, "polygon");
    switch (cellType) {
        case Tessellations.RECT:
            effectiveX = x;
            points = [
                [0, 0],
                [cellDiameter, 0],
                [cellDiameter, effectiveCellHeight],
                [0, effectiveCellHeight]
            ];
            for (point of points) {
                path += (point[0] + effectiveX * cellDiameter) + "," + (point[1] + y * effectiveCellHeight) + " ";
            }
            break;
        case Tessellations.HEX:
            effectiveX = (x + 0.5 * y) % cellsX;
            points = [
                [cellRadius, 0],
                [cellDiameter, cellSide / 2],
                [cellDiameter, effectiveCellHeight],
                [cellRadius, cellSide * 2],
                [0, effectiveCellHeight],
                [0, cellSide / 2]
            ];
            for (point of points) {
                path += (point[0] + effectiveX * cellDiameter) + "," + (point[1] + y * effectiveCellHeight) + " ";
            }
            break;
        case Tessellations.TRIANGLE:
            points = [
                [0, 0],
                [cellDiameter, effectiveCellHeight],
                [0, effectiveCellHeight * 2]
            ];
            for (point of points) {
                var isOddDiagonal = (x + y) % 2;
                var direction = isOddDiagonal ? -1 : 1;
                var _x = direction * point[0] + x * cellDiameter + (isOddDiagonal ? cellDiameter : 0);
                path += _x + "," + (point[1] + y * effectiveCellHeight) + " ";
            }
            break;
    }
    item.setAttributeNS(null, "points", path);
    field.appendChild(item);
    return item;
}

//Cell functions
function updateSum() {
    var neighbour;
    this.sum = 0;
    for (neighbour of this.neighbours) {
        this.sum += neighbour.state;
    }
}

function updateState() {
    this.state = this.state ? (this.sum == 2 || this.sum == 3) : (this.sum == 3);
    this.view.setAttribute("state", this.state);
}

function cellUpdate() {
    if (this.sum === undefined) {
        this.updateSum();
    } else {
        this.updateState();
        this.sum = undefined;
    }
}

function cellOnClick() {
    this.state = !this.state;
    this.view.setAttribute("state", this.state);
}

function createCell(x, y) {
    var cell = {};
    cell.state = Math.random() < density;
    cell.sum = undefined;
    cell.view = createCellView(svgField, x, y);
    cell.neighbours = [];

    cell.view.onclick = cellOnClick.bind(cell);
    cell.updateSum = updateSum.bind(cell);
    cell.updateState = updateState.bind(cell);
    cell.update = cellUpdate.bind(cell);
    return cell;
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
    var result = [];
    var isOddDiagonal = (x + y) % 2;
    var isTriangular = cellType == Tessellations.TRIANGLE;
    var reflected = isOddDiagonal && isTriangular;
    for (var d of displacements) {
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
            grid[x][y] = createCell(x, y);
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
            effectiveCellHeight = cellDiameter;
            break;
        case Tessellations.HEX:
            cellSide = cellRadius / Math.sin(Math.PI / 3);
            effectiveCellHeight = (cellSide * 3 / 2);
            break;
        case Tessellations.TRIANGLE:
            effectiveCellHeight = cellDiameter / Math.tan(Math.PI / 3);
            break;
    }

    cellsX = Math.floor(width / cellDiameter) - 1;
    cellsY = Math.floor(height / effectiveCellHeight) - 1;

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