module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt);
    
    grunt.registerTask('travis', [
        'verbosity:main',
        'eslint:main',
        'sauce',
        'build-prod'
    ]);
};
