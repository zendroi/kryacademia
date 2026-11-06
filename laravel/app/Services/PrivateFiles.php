<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PrivateFiles
{
    private array $staged = [];

    public function store(UploadedFile|string $file, string $name = '', bool $imageOnly = false): array
    {
        $bytes = $file instanceof UploadedFile ? file_get_contents($file->getRealPath()) : $file;
        $name = $file instanceof UploadedFile ? $file->getClientOriginalName() : $name;
        $this->check(strlen($bytes) > 0 && strlen($bytes) <= 8 * 1024 * 1024, 'File must be between 1 byte and 8 MB.');
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        if (in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            $this->check(function_exists('imagewebp') && function_exists('imagecreatefromwebp'), 'Enable PHP GD with JPEG, PNG and WebP support before uploading images.');
            $info = @getimagesizefromstring($bytes);
            $this->check($info && $info[0] > 0 && $info[1] > 0 && $info[0] * $info[1] <= 20000000, 'Image dimensions are invalid or too large.');
            $image = @imagecreatefromstring($bytes);
            $this->check((bool) $image, 'Image could not be decoded.');
            $ratio = min(1, 1800 / max(imagesx($image), imagesy($image)));
            $scaled = imagescale($image, max(1, (int) (imagesx($image) * $ratio)), max(1, (int) (imagesy($image) * $ratio)));
            imagepalettetotruecolor($scaled);
            imagealphablending($scaled, false);
            imagesavealpha($scaled, true);
            ob_start();
            imagewebp($scaled, null, 82);
            $bytes = ob_get_clean();
            imagedestroy($scaled);
            imagedestroy($image);
            $mime = 'image/webp';
            $name = pathinfo(basename(str_replace('\\', '/', $name)), PATHINFO_FILENAME).'.webp';
        } else {
            $this->check(! $imageOnly && $mime === 'application/pdf', 'Only JPEG, PNG, WebP images or safe PDF documents are accepted.');
            $this->check(strlen($bytes) <= 1048576 && preg_match('/\A%PDF-(?:1\.[0-7]|2\.0)/', $bytes) && str_contains(substr($bytes, -1024), '%%EOF'), 'Invalid or oversized PDF.');
            $scan = $bytes;
            preg_match_all('/stream\r?\n(.*?)\r?\nendstream/s', $bytes, $streams);
            foreach ($streams[1] as $stream) {
                if (strlen($stream) > 1 && ord($stream[0]) === 0x78) {
                    $decoded = @gzuncompress($stream, 4194304);
                    $this->check($decoded !== false && strlen($scan) + strlen($decoded) <= 8388608, 'PDF compression is invalid or too large.');
                    $scan .= $decoded;
                }
            }
            $scan = preg_replace_callback('/#([a-f0-9]{2})/i', fn (array $match) => chr(hexdec($match[1])), $scan);
            $this->check(! preg_match('~/\s*(?:JavaScript|JS|OpenAction|AA|Launch|EmbeddedFile|Filespec|RichMedia|XFA|SubmitForm|ImportData|GoToR|URI|Encrypt|AcroForm)\b~i', $scan), 'PDF contains active or embedded content. Export a plain PDF or use the Canva link.');
            $this->check(! preg_match('~/Filter\s*(?!/FlateDecode\b|/DCTDecode\b|/JPXDecode\b)(?:/|\[)~', $scan), 'Unsupported PDF encoding. Export a plain PDF.');
        }
        $this->check(strlen($bytes) <= 1048576, 'Compressed file must be at most 1 MB.');
        $id = (string) Str::uuid();
        $path = 'objects/'.$id;
        if (! Storage::disk('local')->put($path, $bytes)) {
            throw new \RuntimeException('Private storage is unavailable.');
        }
        $this->staged[] = $id;
        DB::table('portal_file_objects')->insert(['id' => $id, 'pathname' => $path, 'provider' => 'local', 'size' => strlen($bytes), 'sha256' => hash('sha256', $bytes), 'ready' => true, 'created_at' => now()]);

        return ['id' => $id, 'name' => mb_substr($name ?: 'document', 0, 180), 'mime' => $mime, 'size' => strlen($bytes)];
    }

    public function fromData(array $file, bool $imageOnly = false): array
    {
        $this->check(is_string($file['data'] ?? null) && strlen($file['data']) <= 12000000, 'Invalid attachment.');
        $this->check((bool) preg_match('~\Adata:(image/(?:jpeg|png|webp)|application/pdf);base64,([A-Za-z0-9+/=\r\n]+)\z~', $file['data'], $match), 'Invalid file encoding.');
        $bytes = base64_decode($match[2], true);
        $this->check($bytes !== false, 'Invalid file encoding.');

        return $this->store($bytes, (string) ($file['name'] ?? 'document'), $imageOnly);
    }

    public function read(object $object): string
    {
        $path = $object->local_path ?? $object->pathname;
        $this->check((bool) $object->ready && ($object->provider === 'local' || ! empty($object->local_path)) && preg_match('~\A(?:objects/|portal/)?[a-f0-9-]{36}\z~i', $path), 'File is not available locally.');
        $bytes = Storage::disk('local')->get($path);
        if (! is_string($bytes) || strlen($bytes) !== (int) $object->size || ! hash_equals($object->sha256, hash('sha256', $bytes))) {
            throw new \RuntimeException('Private file integrity check failed.');
        }

        return $bytes;
    }

    public function rollback(): void
    {
        foreach ($this->staged as $id) {
            Storage::disk('local')->delete('objects/'.$id);
        }
        $this->staged = [];
    }

    public function commit(): void
    {
        $this->staged = [];
    }

    private function check(bool $condition, string $message): void
    {
        if (! $condition) {
            throw ValidationException::withMessages(['file' => $message]);
        }
    }
}
