module.exports = function (grunt) {
  grunt.initConfig({
    nodeunit: {
      all: ['test/**/*.js'],
    },
    jshint: {
      all: ['js/*.js'],
      options: {
        jshintrc: '.jshintrc',
      },
    },
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');

  grunt.registerTask('travis', ['jshint']);
};
