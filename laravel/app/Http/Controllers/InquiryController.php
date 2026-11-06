<?php

namespace App\Http\Controllers;

use App\Models\Inquiry;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class InquiryController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:254'],
            'phone' => ['required', 'string', 'max:30', 'regex:/^\+?[\d ()-]+$/', function (string $attribute, mixed $value, \Closure $fail): void {
                if (! preg_match('/^\d{8,15}$/', preg_replace('/\D/', '', (string) $value))) {
                    $fail('Enter a valid phone number.');
                }
            }],
            'place' => ['required', 'string', 'max:120'],
            'type' => ['required', 'in:Workshop,Klass,Program,School Partnership,Event,Other'],
            'affiliation' => ['required', 'in:Institution,Parent,Non-institution'],
            'institution' => ['required_if:affiliation,Institution', 'nullable', 'string', 'max:180'],
            'message' => ['required', 'string', 'min:1', 'max:5000'],
            'language' => ['required', 'in:en,id,zh'],
            'details' => ['required', 'array:klass,mode,program,schoolLevel,request'],
            'details.klass' => ['required_if:type,Klass', 'string', 'max:180'],
            'details.mode' => ['required_if:type,Klass', 'in:Online,Onsite'],
            'details.program' => ['required_if:type,Program', 'string', 'max:180'],
            'details.schoolLevel' => ['required_if:type,School Partnership', 'string', 'max:180'],
            'details.request' => ['required_if:type,Workshop,Event,Other', 'string', 'max:1000'],
            'website' => ['nullable', 'string', 'max:0'],
            'consent' => ['accepted'],
        ]);

        $submissionHash = hash('sha256', json_encode($validated));

        Inquiry::firstOrCreate(['submission_hash' => $submissionHash], [
            'id' => Str::uuid()->toString(),
            'submission_hash' => $submissionHash,
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'],
            'place' => $validated['place'],
            'type' => $validated['type'],
            'affiliation' => $validated['affiliation'],
            'institution' => $validated['institution'] ?? '',
            'message' => $validated['message'],
            'language' => $validated['language'] ?? 'en',
            'details' => $validated['details'] ?? [],
            'status' => 'New',
        ]);

        return back()->with('success', 'Inquiry sent successfully!');
    }
}
