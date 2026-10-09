"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "getRootDirs", {
    enumerable: true,
    get: function() {
        return getRootDirs;
    }
});
var _tinyglobby = require("tinyglobby");
var _path = require("node:path");
/**
 * Process a Next.js root directory glob.
 */ var processRootDir = function(rootDir) {
    var pattern = rootDir.replace(/\\/g, '/');
    if (pattern.length > 4096) throw new TypeError('Next lint root pattern is too long');
    var depth = 0;
    for (var character of pattern) {
        if (character === '{' && ++depth > 128) throw new TypeError('Next lint root pattern is too deeply nested');
        if (character === '}') depth = Math.max(0, depth - 1);
    }
    return (0, _tinyglobby.globSync)(pattern, {
        onlyDirectories: true,
        expandDirectories: false,
        absolute: _path.isAbsolute(pattern)
    }).map(function(dir) { return dir.length > 1 ? dir.replace(/\/$/, '') : dir; });
};
var getRootDirs = function(context) {
    var rootDirs = [
        context.cwd
    ];
    var nextSettings = context.settings.next || {};
    var rootDir = nextSettings.rootDir;
    if (typeof rootDir === 'string') {
        rootDirs = processRootDir(rootDir);
    } else if (Array.isArray(rootDir)) {
        rootDirs = rootDir.map(function(dir) {
            return typeof dir === 'string' ? processRootDir(dir) : [];
        }).flat();
    }
    return rootDirs;
};
