import { useState, useCallback, useRef } from 'react';
import type { ChangeEvent, FormEvent, DragEvent } from 'react';
import axios from 'axios';
import {
  Upload,
  FileText,
  Download,
  Image,
  Video,
  FileBarChart,
  File,
} from 'lucide-react';
import type { Evidence, EvidenceType } from '@/types';
import { uploadEvidence, downloadEvidence } from '@/api/evidence';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/ToastProvider';

// ---------------------------------------------------------------------------
// EvidencePage — upload evidence files and view recent uploads.
// ---------------------------------------------------------------------------

const EVIDENCE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'log', label: 'Log' },
  { value: 'screenshot', label: 'Screenshot' },
  { value: 'video', label: 'Video' },
  { value: 'document', label: 'Document' },
  { value: 'report', label: 'Report' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function evidenceTypeIcon(type: EvidenceType): React.ReactNode {
  const iconProps = { size: 16, strokeWidth: 1.5, 'aria-hidden': true as const };
  switch (type) {
    case 'log':
      return <FileText {...iconProps} />;
    case 'screenshot':
      return <Image {...iconProps} />;
    case 'video':
      return <Video {...iconProps} />;
    case 'report':
      return <FileBarChart {...iconProps} />;
    case 'document':
    default:
      return <File {...iconProps} />;
  }
}

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

function buildColumns(onDownload: (row: Evidence) => void): Column<Evidence>[] {
  return [
    {
      key: 'file_name',
      header: 'Filename',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-2">
          {evidenceTypeIcon(row.evidence_type)}
          <span className="truncate max-w-[200px]">{String(val ?? '')}</span>
        </div>
      ),
    },
    {
      key: 'evidence_type',
      header: 'Type',
      sortable: true,
      render: (val) => <StatusBadge status={String(val ?? '')} variant="info" />,
    },
    {
      key: 'file_size',
      header: 'Size',
      sortable: true,
      render: (val) => (
        <span className="font-mono tabular-nums">
          {formatFileSize(Number(val ?? 0))}
        </span>
      ),
    },
    {
      key: 'uploaded_by',
      header: 'Uploaded By',
      sortable: true,
    },
    {
      key: 'uploaded_at',
      header: 'Date',
      sortable: true,
      render: (val) => (
        <span className="whitespace-nowrap">{formatDate(String(val ?? ''))}</span>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      render: (_val, row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDownload(row);
          }}
          className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          aria-label={`Download ${row.file_name}`}
        >
          <Download size={14} strokeWidth={1.5} aria-hidden="true" />
          Download
        </button>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Upload form state
// ---------------------------------------------------------------------------

interface UploadFormState {
  test_execution_id: string;
  test_case_id: string;
  evidence_type: string;
}

const INITIAL_FORM: UploadFormState = {
  test_execution_id: '',
  test_case_id: '',
  evidence_type: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function EvidencePage() {
  const { addToast } = useToast();

  // ---- Upload form ----
  const [form, setForm] = useState<UploadFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof UploadFormState, string>>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Drag state ----
  const [isDragging, setIsDragging] = useState(false);

  // ---- Recent uploads (local state — no list API available) ----
  const [recentUploads, setRecentUploads] = useState<Evidence[]>([]);

  // ---- Download state ----
  const [downloading, setDownloading] = useState<string | null>(null);

  // ---- Form handlers ----
  const handleFormChange = useCallback(
    (field: keyof UploadFormState) => (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [],
  );

  const handleFileSelect = useCallback((file: File | null) => {
    setSelectedFile(file);
    setFileError(null);
  }, []);

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      handleFileSelect(file);
    },
    [handleFileSelect],
  );

  // ---- Drag & drop ----
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0] ?? null;
      handleFileSelect(file);
    },
    [handleFileSelect],
  );

  // ---- Validate ----
  const validateForm = useCallback((): boolean => {
    const errs: Partial<Record<keyof UploadFormState, string>> = {};
    if (!form.test_execution_id.trim()) errs.test_execution_id = 'Test execution ID is required';
    if (!form.evidence_type) errs.evidence_type = 'Evidence type is required';
    setFormErrors(errs);

    if (!selectedFile) {
      setFileError('Please select a file to upload');
      return false;
    }

    return Object.keys(errs).length === 0;
  }, [form, selectedFile]);

  // ---- Upload ----
  const handleUpload = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!validateForm()) return;
      if (!selectedFile) return;

      setUploading(true);
      setUploadProgress(0);
      setUploadError(null);

      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('test_execution_id', form.test_execution_id);
        formData.append('evidence_type', form.evidence_type);
        if (form.test_case_id.trim()) {
          formData.append('test_case_id', form.test_case_id);
        }

        // Simulate progress since uploadEvidence uses axios internally
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 10;
          });
        }, 200);

        const result = await uploadEvidence(formData);

        clearInterval(progressInterval);
        setUploadProgress(100);

        setRecentUploads((prev) => [result, ...prev]);
        addToast({ message: 'Evidence uploaded successfully.', variant: 'success' });

        // Reset form
        setForm(INITIAL_FORM);
        setFormErrors({});
        setSelectedFile(null);
        setFileError(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        // Reset progress after a brief delay
        setTimeout(() => setUploadProgress(0), 1000);
      } catch (err: unknown) {
        const msg =
          axios.isAxiosError(err) && err.response?.data?.detail
            ? String(err.response.data.detail)
            : 'Failed to upload evidence.';
        setUploadError(msg);
        addToast({ message: msg, variant: 'error' });
        setUploadProgress(0);
      } finally {
        setUploading(false);
      }
    },
    [form, selectedFile, validateForm, addToast],
  );

  // ---- Download ----
  const handleDownload = useCallback(
    async (row: Evidence) => {
      setDownloading(row.id);
      try {
        const blob = await downloadEvidence(row.id);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = row.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (err: unknown) {
        const msg =
          axios.isAxiosError(err) && err.response?.data?.detail
            ? String(err.response.data.detail)
            : 'Failed to download evidence.';
        addToast({ message: msg, variant: 'error' });
      } finally {
        setDownloading(null);
      }
    },
    [addToast],
  );

  // ---- Table columns (with download handler) ----
  const tableColumns = buildColumns(handleDownload);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Evidence' },
        ]}
      />

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Evidence
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Upload and manage test evidence files — logs, screenshots, videos, and reports.
        </p>
      </div>

      {/* Upload section */}
      <Card padding="lg">
        <h2 className="text-lg font-semibold text-foreground mb-4">Upload Evidence</h2>

        {uploadError && (
          <Alert
            variant="error"
            className="mb-4"
            onDismiss={() => setUploadError(null)}
          >
            {uploadError}
          </Alert>
        )}

        <form onSubmit={handleUpload} noValidate className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              label="Test Execution ID"
              name="upload-exec"
              required
              error={formErrors.test_execution_id}
            >
              <input
                id="upload-exec"
                name="upload-exec"
                type="text"
                value={form.test_execution_id}
                onChange={handleFormChange('test_execution_id')}
                disabled={uploading}
                aria-required="true"
                aria-invalid={!!formErrors.test_execution_id || undefined}
                aria-describedby={
                  formErrors.test_execution_id ? 'upload-exec-error' : undefined
                }
                placeholder="Enter execution ID"
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50"
              />
            </FormField>

            <FormField
              label="Test Case ID"
              name="upload-case"
              hint="Optional"
            >
              <input
                id="upload-case"
                name="upload-case"
                type="text"
                value={form.test_case_id}
                onChange={handleFormChange('test_case_id')}
                disabled={uploading}
                placeholder="Enter test case ID (optional)"
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50"
              />
            </FormField>

            <Select
              label="Evidence Type"
              name="upload-type"
              options={EVIDENCE_TYPE_OPTIONS}
              value={form.evidence_type}
              onChange={handleFormChange('evidence_type')}
              required
              error={formErrors.evidence_type}
              placeholder="Select type"
              disabled={uploading}
            />
          </div>

          {/* Drag & drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            aria-label="Drop a file here or click to browse"
            className={`flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-8 cursor-pointer transition-colors duration-fast ${
              isDragging
                ? 'border-primary-600 bg-primary-600/5'
                : fileError
                  ? 'border-error bg-error-light/30'
                  : 'border-border hover:border-neutral-400 hover:bg-surface-raised'
            }`}
          >
            <Upload
              size={32}
              strokeWidth={1.5}
              className="text-foreground-muted"
              aria-hidden="true"
            />
            {selectedFile ? (
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-foreground-muted">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-foreground">
                  Drag and drop a file here, or{' '}
                  <span className="font-medium text-primary-600">browse</span>
                </p>
                <p className="text-xs text-foreground-muted mt-1">
                  Supports logs, screenshots, videos, documents, and reports
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInputChange}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>

          {fileError && (
            <p className="text-xs text-error" role="alert">
              {fileError}
            </p>
          )}

          {/* Upload progress */}
          {uploading && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-foreground-muted">
                <span>Uploading…</span>
                <span className="font-mono tabular-nums">{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-600 transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                  role="progressbar"
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Upload progress"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => {
                setForm(INITIAL_FORM);
                setFormErrors({});
                setSelectedFile(null);
                setFileError(null);
                setUploadError(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              disabled={uploading}
            >
              Reset
            </Button>
            <Button type="submit" variant="primary" size="md" loading={uploading}>
              <Upload size={16} strokeWidth={1.5} aria-hidden="true" />
              Upload Evidence
            </Button>
          </div>
        </form>
      </Card>

      {/* Recent uploads */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Recent Uploads</h2>

        {downloading && (
          <p className="text-sm text-foreground-muted" role="status" aria-live="polite">
            Downloading…
          </p>
        )}

        {recentUploads.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={FileText}
              title="No uploads yet"
              description="Upload evidence files above to see them listed here."
            />
          </Card>
        ) : (
          <DataTable<Evidence>
            data={recentUploads}
            columns={tableColumns}
            emptyMessage="No evidence files"
          />
        )}
      </div>
    </div>
  );
}

export default EvidencePage;
