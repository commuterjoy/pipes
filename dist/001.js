'use strict';

var memwatch = require('memwatch-next');
var es = require('event-stream');
var JSONStream = require('JSONStream');
var inspect = require('util').inspect;
var Readable = require('stream').Readable;
var domain = require('domain');
require('es6-promise').polyfill();

memwatch.on('leak', function (info) {
	console.log(info);
});
memwatch.on('stats', function (stats) {
	console.log(stats);
});
var ls = 0;

var pipeline = function pipeline(s) {
	s.pipe(JSONStream.parse())
	//.pipe(es.log())
	.pipe(es.map(function (data, next) {
		data.foo = 1;
		next(null, data);
	})).pipe(es.map(function (data, next) {
		var t = Math.random() * 3000;
		data.t = t;
		setTimeout(function () {
			next(null, data);
		}, t);
	})).pipe(es.map(function (data, next) {
		Promise.all([new Promise(function (resolve, reject) {
			// a response from CAPI
			resolve(1);
		}), new Promise(function (resolve, reject) {
			// a response from Session API
			setTimeout(function () {
				resolve(2);
			}, Math.random() * 1000); // proves the messages don't have to arrive in order
		}), Promise.resolve(data) // not sure how to return the original data other than this
		]).then(function (a) {
			//console.log('what the promise said', a);
			next(null, data);
		});
	})).pipe(es.map(function (data, next) {
		if (Math.random() > 0.9) throw new Error('something terrible is afoot');
		next(null, data);
	})).pipe(es.stringify()).pipe(es.map(function (data, next) {
		ls--;
		next(null, data.replace(/[ab]/g, '-'));
	})).pipe(es.map(function (data, next) {
		console.log(ls, process.memoryUsage());
		next(null, data.replace(/[ab]/g, '-'));
	}));
};

var c = 1;

setInterval(function () {
	var s = new Readable();
	s._read = function noop() {}; // redundant? see update below
	s.push('{"bar":"1abcasdf", "c": ' + c++ + '}');
	s.push(null);

	ls++;

	var d = domain.create();
	d.on('error', function (err) {
		ls--;
		console.log('error');
	});
	d.run(function () {
		pipeline(s);
	});
}, 500);