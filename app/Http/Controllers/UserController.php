<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class UserController extends Controller
{
    public function updateProfilePicture(Request $request)
    {
        $request->validate([
            'profile_picture' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
        ]);

        $user = $request->user();
        $previousPath = $user->profile_picture_path;
        $path = $request->file('profile_picture')->store('profile-pictures', 'public');

        if ($path === false) {
            throw new \RuntimeException('Unable to store the profile picture.');
        }

        $user->profile_picture_path = $path;
        $user->save();

        if ($previousPath) {
            Storage::disk('public')->delete($previousPath);
        }

        return response()->json(['user' => $user->fresh()]);
    }

    public function assignRole(Request $request, User $user)
    {
        $request->validate([
            'role_id' => 'required|exists:roles,id',
        ]);

        $user->roles()->attach($request->role_id);

        return response()->json(['message' => 'Role assigned successfully.']);
    }

    public function removeRole(Request $request, User $user)
    {
        $request->validate([
            'role_id' => 'required|exists:roles,id',
        ]);

        $user->roles()->detach($request->role_id);

        return response()->json(['message' => 'Role removed successfully.']);
    }
}
