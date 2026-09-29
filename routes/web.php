<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/vanilla-api/{file?}', function (?string $file = 'index.html') {
    $path = base_path('vanilla-api/' . $file);

    if (! file_exists($path)) {
        abort(404);
    }

    $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

    $mimeTypes = [
        'css' => 'text/css; charset=utf-8',
        'js' => 'application/javascript; charset=utf-8',
        'html' => 'text/html; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
    ];

    return response()->file($path, [
        'Content-Type' => $mimeTypes[$extension] ?? 'text/plain; charset=utf-8',
    ]);
});
