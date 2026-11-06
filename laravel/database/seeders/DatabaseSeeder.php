<?php

namespace Database\Seeders;

use App\Models\CoachProfile;
use App\Models\Institution;
use App\Models\KlassType;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new \RuntimeException('Demo seeding is disabled outside local/testing. Use the verified company import.');
        }
        // 1. Seed Users
        User::firstOrCreate(
            ['email' => 'admin@krya.global'],
            [
                'name' => 'KRYA Admin',
                'password' => Hash::make('KryacademiaAdmin2026!'),
                'role' => 'admin',
                'status' => 'active',
                'phone' => '+6285111212362',
            ]
        );

        User::firstOrCreate(
            ['email' => 'teacher@krya.global'],
            [
                'name' => 'Liza Stephanie',
                'password' => Hash::make('KryacademiaTeacher2026!'),
                'role' => 'teacher',
                'status' => 'active',
                'phone' => '+6281234567890',
                'bank_name' => 'BCA',
                'bank_account' => '1234567890',
                'account_holder' => 'Liza Stephanie',
            ]
        );

        // 2. Seed Institutions
        $institutions = [
            ['id' => 'elyon', 'name' => 'Elyon Christian School Surabaya', 'city' => 'Surabaya', 'country' => 'Indonesia', 'logo' => '/partners/9.jpg'],
            ['id' => 'xin-zhong', 'name' => 'Xin Zhong School', 'city' => 'Surabaya', 'country' => 'Indonesia', 'logo' => '/partners/4.jpg'],
            ['id' => 'sman-5', 'name' => 'SMA Negeri 5 Surabaya', 'city' => 'Surabaya', 'country' => 'Indonesia', 'logo' => '/partners/5.jpg'],
            ['id' => 'petra', 'name' => 'Petra Christian School', 'city' => 'Surabaya', 'country' => 'Indonesia', 'logo' => '/partners/92.png'],
            ['id' => 'sampoerna', 'name' => 'Sampoerna Academy', 'city' => 'Surabaya', 'country' => 'Indonesia', 'logo' => '/partners/81.png'],
            ['id' => 'gloria', 'name' => 'Gloria Christian School', 'city' => 'Surabaya', 'country' => 'Indonesia', 'logo' => '/partners/6.jpg'],
            ['id' => 'dharma-mulya', 'name' => 'Dharma Mulya', 'city' => 'Surabaya', 'country' => 'Indonesia', 'logo' => '/partners/8.jpg'],
        ];

        foreach ($institutions as $inst) {
            Institution::firstOrCreate(
                ['id' => $inst['id']],
                [
                    'name' => $inst['name'],
                    'city' => $inst['city'],
                    'country' => $inst['country'],
                    'logo' => $inst['logo'],
                    'about' => 'Partner school collaborating with KRYAcademia.',
                    'address' => $inst['city'],
                    'contact_name' => 'School Coordinator',
                    'email' => 'partner@krya.global',
                    'phone' => '+6285111212362',
                    'website' => 'https://krya.global',
                    'active' => true,
                ]
            );
        }

        // 3. Seed Klass Types
        $klasses = [
            ['id' => 'steamaker', 'title' => 'STEAMaker Upcycling Project', 'category' => 'Innovation & Creativity', 'image' => '/klass/steamaker-cikal.webp', 'description' => 'Explore everyday challenges through hands-on STEAM projects and upcycling.'],
            ['id' => 'innovation', 'title' => 'Innovation Klass', 'category' => 'Innovation & Creativity', 'image' => '/klass/innovation-gloria.webp', 'description' => 'Develop creative solutions to real-world problems through practical projects.'],
            ['id' => 'maker-set', 'title' => 'Kryative Maker Set', 'category' => 'Innovation & Creativity', 'image' => '/klass/kryative-maker-set.webp', 'description' => 'Discover thematic STEAM activities with a hands-on learning kit.'],
            ['id' => 'biotechnology', 'title' => 'Biotechnology', 'category' => 'Technology', 'image' => '/klass/biotechnology-xin-zhong.webp', 'description' => 'Connect everyday science with curiosity, teamwork, and environmental awareness.'],
            ['id' => 'coding-klass', 'title' => 'Digitechnology Coding Klass', 'category' => 'Technology', 'image' => '/klass/digitechnology-coding.webp', 'description' => 'Create purposeful digital projects while developing coding and problem-solving skills.'],
            ['id' => 'edubit', 'title' => 'Digitechnology Krya x EDU:bit', 'category' => 'Technology', 'image' => '/klass/digitechnology-edubit.webp', 'description' => 'Explore coding, visual design, and three-dimensional game creation.'],
            ['id' => 'ar-storytelling', 'title' => 'Digitechnology AR Storytelling', 'category' => 'Technology', 'image' => '/klass/digitechnology-ar-storytelling.webp', 'description' => 'Create augmented-reality stories that connect digital and physical worlds.'],
            ['id' => 'digital-animation', 'title' => 'Digital Animation', 'category' => 'Art & Language', 'image' => '/klass/digital-animation.webp', 'description' => 'Develop animation fundamentals through structured, creative practice.'],
            ['id' => 'anime-drawing', 'title' => 'Anime Drawing', 'category' => 'Art & Language', 'image' => '/klass/anime-drawing.webp', 'description' => 'Draw characters and express original stories through anime-inspired art.'],
            ['id' => 'architecture', 'title' => 'Architecture and Interior', 'category' => 'Art & Language', 'image' => '/klass/visual-thinking-chung-chung.webp', 'description' => 'Explore creativity and aesthetic awareness through visual and digital arts.'],
        ];

        foreach ($klasses as $k) {
            KlassType::firstOrCreate(
                ['id' => $k['id']],
                [
                    'title' => $k['title'],
                    'category' => $k['category'],
                    'image' => $k['image'],
                    'description' => $k['description'],
                    'active' => true,
                ]
            );
        }

        // 4. Seed Coach Profiles
        $coaches = [
            ['id' => 'liza', 'name' => 'Liza Stephanie', 'specialty' => 'STEAM Projects', 'image' => '/coaches/liza-stephanie.jpg', 'portal_email' => 'teacher@krya.global'],
            ['id' => 'sintowati', 'name' => 'Sintowati S.', 'specialty' => 'Creative Learning', 'image' => '/coaches/sintowati.jpg'],
            ['id' => 'gabriel', 'name' => 'Gabriel Ryan', 'specialty' => 'Science', 'image' => '/coaches/gabriel-ryan.jpg'],
            ['id' => 'sara', 'name' => 'Sara Rustiani B.', 'specialty' => 'Biotechnology', 'image' => '/coaches/sara-rustiani.jpg'],
            ['id' => 'wahyu', 'name' => 'Wahyu Wido S.', 'specialty' => 'Mathematics & Logic', 'image' => '/coaches/wahyu-wido.jpg'],
            ['id' => 'lavida', 'name' => 'Lavida Melia', 'specialty' => 'Environmental Studies', 'image' => '/coaches/lavida-melia.jpg'],
            ['id' => 'daniel', 'name' => 'Daniel Richard R.', 'specialty' => 'Coding & Game Design', 'image' => '/coaches/daniel-richard.jpg'],
            ['id' => 'jeremy', 'name' => 'Jeremy Nathanael R.', 'robotic' => 'Robotics', 'specialty' => 'Robotics', 'image' => '/coaches/jeremy-nathanael.jpg'],
        ];

        foreach ($coaches as $c) {
            CoachProfile::firstOrCreate(
                ['id' => $c['id']],
                [
                    'name' => $c['name'],
                    'specialty' => $c['specialty'],
                    'image' => $c['image'],
                    'portal_email' => $c['portal_email'] ?? ($c['id'].'@krya.global'),
                    'bio' => 'Experienced mentor dedicated to hands-on 21st-century education.',
                    'active' => true,
                ]
            );
        }
    }
}
