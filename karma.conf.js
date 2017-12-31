module.exports = function(config) {
    config.set({

        basePath: '',
        frameworks: ['browserify', 'jasmine'],

        files: [
            '_src/**/*.js',
            '_test/**/*.spec.js'
        ],

        exclude: [
        ],

        browsers: [
            'PhantomJS'
        ],

        reporters: [
            'progress',
            'coverage'
        ],

        coverageReporter: {
            type: 'lcov',
            dir: 'coverage/'
        },

        preprocessors: {
            '_src/**/*.js': ['browserify', 'coverage'],
            '_test/**/*.spec.js': ['browserify']
        },

        browserify: {
            debug: true,
            transform: [ ['babelify', { "presets": ["es2015"] }] ]
        },
    });
};