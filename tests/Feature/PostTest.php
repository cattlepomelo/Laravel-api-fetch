<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PostTest extends TestCase
{
    use RefreshDatabase;

    public function test_anyone_can_list_and_show_posts(): void
    {
        $post = Post::factory()->create();

        $this->getJson('/api/posts')->assertOk()->assertJsonCount(1);
        $this->getJson("/api/posts/{$post->id}")->assertOk()->assertJsonPath('title', $post->title);
    }

    public function test_posts_are_listed_newest_first(): void
    {
        $olderPost = Post::factory()->create(['created_at' => now()->subMinute()]);
        $newerPost = Post::factory()->create(['created_at' => now()]);

        $this->getJson('/api/posts')
            ->assertOk()
            ->assertJsonPath('0.id', $newerPost->id)
            ->assertJsonPath('1.id', $olderPost->id);
    }

    public function test_guest_cannot_create_post(): void
    {
        $this->postJson('/api/posts', ['title' => 'Hi', 'body' => 'Text'])->assertUnauthorized();
    }

    public function test_user_can_create_post(): void
    {
        $user = User::factory()->create();

        $this->withTokenFor($user)
            ->postJson('/api/posts', ['title' => 'Hi', 'body' => 'Text'])
            ->assertCreated()
            ->assertJsonPath('user_id', $user->id);

        $this->assertDatabaseHas('posts', ['title' => 'Hi', 'user_id' => $user->id]);
    }

    public function test_create_post_validates_input(): void
    {
        $this->withTokenFor(User::factory()->create())
            ->postJson('/api/posts', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title', 'body']);
    }

    public function test_owner_can_update_post(): void
    {
        $post = Post::factory()->create();

        $this->withTokenFor($post->user)
            ->putJson("/api/posts/{$post->id}", ['title' => 'New', 'body' => 'New body'])
            ->assertOk()
            ->assertJsonPath('title', 'New');
    }

    public function test_other_user_cannot_update_post(): void
    {
        $post = Post::factory()->create();

        $this->withTokenFor(User::factory()->create())
            ->putJson("/api/posts/{$post->id}", ['title' => 'New', 'body' => 'New body'])
            ->assertForbidden();
    }

    public function test_owner_can_delete_post(): void
    {
        $post = Post::factory()->create();

        $this->withTokenFor($post->user)->deleteJson("/api/posts/{$post->id}")->assertOk();

        $this->assertDatabaseMissing('posts', ['id' => $post->id]);
    }

    public function test_other_user_cannot_delete_post(): void
    {
        $post = Post::factory()->create();

        $this->withTokenFor(User::factory()->create())->deleteJson("/api/posts/{$post->id}")->assertForbidden();

        $this->assertDatabaseHas('posts', ['id' => $post->id]);
    }

    public function test_owner_can_change_status(): void
    {
        $post = Post::factory()->create();

        $this->withTokenFor($post->user)
            ->patchJson("/api/posts/{$post->id}/status", ['post_status_id' => 2])
            ->assertOk()
            ->assertJsonPath('status.name', 'private');
    }

    public function test_status_must_exist(): void
    {
        $post = Post::factory()->create();

        $this->withTokenFor($post->user)
            ->patchJson("/api/posts/{$post->id}/status", ['post_status_id' => 999])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['post_status_id']);
    }

    public function test_other_user_cannot_change_status(): void
    {
        $post = Post::factory()->create();

        $this->withTokenFor(User::factory()->create())
            ->patchJson("/api/posts/{$post->id}/status", ['post_status_id' => 2])
            ->assertForbidden();
    }
}
