<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProfilePictureTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_upload_and_replace_their_profile_picture(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/user/profile-picture', [
            'profile_picture' => $this->fakePng('profile.png'),
        ]);

        $response->assertOk()->assertJsonPath('user.id', $user->id);
        $firstPath = $user->fresh()->profile_picture_path;
        Storage::disk('public')->assertExists($firstPath);
        $response->assertJsonPath('user.profile_picture_url', Storage::disk('public')->url($firstPath));

        $this->withToken($token)->postJson('/api/user/profile-picture', [
            'profile_picture' => $this->fakePng('updated.png'),
        ])->assertOk();

        Storage::disk('public')->assertMissing($firstPath);
        Storage::disk('public')->assertExists($user->fresh()->profile_picture_path);
    }

    public function test_profile_picture_upload_requires_authentication(): void
    {
        $this->postJson('/api/user/profile-picture', [
            'profile_picture' => $this->fakePng('profile.png'),
        ])->assertUnauthorized();
    }

    public function test_profile_picture_upload_rejects_non_images(): void
    {
        $user = User::factory()->create();

        $this->withToken($user->createToken('test')->plainTextToken)
            ->postJson('/api/user/profile-picture', [
                'profile_picture' => UploadedFile::fake()->create('document.pdf', 100, 'application/pdf'),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['profile_picture']);
    }

    private function fakePng(string $name): UploadedFile
    {
        $contents = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6a8AAAAASUVORK5CYII=');

        return UploadedFile::fake()->createWithContent($name, $contents);
    }
}
