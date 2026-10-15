<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\UserController;
use App\Http\Middleware\RoleMiddleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::apiResource('posts', PostController::class);
Route::patch('posts/{post}/status', [PostController::class, 'updateStatus']);
Route::apiResource('posts.comments', CommentController::class);

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('user/profile-picture', [UserController::class, 'updateProfilePicture']);
    Route::post('users/{user}/assign-role', [UserController::class, 'assignRole']);
    Route::post('users/{user}/remove-role', [UserController::class, 'removeRole']);
});

// Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
//     // Admin-only routes
//     Route::post('users/{user}/assign-role', [UserController::class, 'assignRole']);
//     Route::post('users/{user}/remove-role', [UserController::class, 'removeRole']);
// });

// Route::middleware(RoleMiddleware::class.':admin')->group(function (string $role) {
//     // Admin-only routes
//     Route::post('users/{user}/assign-role', [UserController::class, 'assignRole']);
//     Route::post('users/{user}/remove-role', [UserController::class, 'removeRole']);
// });

// RoleMiddleware

// Route::put('/post/{id}', function (string $id) {

//     // ...

// })->middleware(EnsureUserHasRole::class.':editor');

// Route::post('users/{user}/assign-role', [UserController::class, 'assignRole'])->middleware(RoleMiddleware::class.':admin');
// Route::post('users/{user}/remove-role', [UserController::class, 'removeRole']);
