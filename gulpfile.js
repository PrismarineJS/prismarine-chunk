var gulp = require('gulp');

var babel = require('gulp-babel');

gulp.task('transpile', function() {
    gulp.src('src/*.js')
        .pipe(babel())
        .pipe(gulp.dest('dist/'));
});

gulp.task('watch', function() {
    gulp.run('transpile');
    gulp.watch('src/*.js', ['transpile']);
});

gulp.task('default', ['transpile']);
