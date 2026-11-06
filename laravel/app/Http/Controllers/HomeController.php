<?php

namespace App\Http\Controllers;

use App\Models\CoachProfile;
use App\Models\Institution;
use App\Models\KlassType;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function index(): Response
    {
        $klasses = KlassType::where('active', true)->orderBy('sort_order')->get();
        $coaches = CoachProfile::where('active', true)->orderBy('sort_order')->get();
        $institutions = Institution::where('active', true)->orderBy('sort_order')->get();
        $teams = [];
        foreach ($klasses as $klass) {
            $assigned = DB::table('coach_assignments as a')->join('class_groups as g', 'g.id', '=', 'a.class_group_id')->where('g.klass_type_id', $klass->id)->where('g.active', true)->pluck('a.coach_id')->all();
            $teams[$klass->title] = $coaches->whereIn('id', $assigned)->map(fn ($coach) => [$coach->name, $coach->specialty, $coach->image ?? ''])->values()->all();
        }

        return Inertia::render('Welcome', [
            'publicCatalog' => [
                'klasses' => $klasses->map(function ($klass): array {
                    $modes = DB::table('class_groups')->where('klass_type_id', $klass->id)->where('active', true)->distinct()->pluck('mode');
                    $mode = $modes->contains('Hybrid') || $modes->count() > 1 ? 'Hybrid' : ($modes->first() ?? 'Online');

                    return [$klass->title, $mode, $klass->category, '', $klass->image ?? '', $klass->description ?? ''];
                })->all(),
                'coaches' => $coaches->map(fn ($coach) => [$coach->name, $coach->specialty, $coach->image ?? ''])->all(),
                'teams' => $teams,
                'partners' => $institutions->map(fn ($institution) => ['name' => $institution->name, 'logo' => $institution->logo ?? ''])->all(),
            ],
        ]);
    }
}
