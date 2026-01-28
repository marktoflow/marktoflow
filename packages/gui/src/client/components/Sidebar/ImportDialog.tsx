/**
 * Import Dialog Component
 * Allows users to import workflow files (.md, .yaml, .yml, .zip)
 */

import { useState, useRef } from 'react';
import { Modal, ModalFooter } from '../common/Modal';
import { Button } from '../common/Button';
import { Upload, FileText, Archive, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

interface ImportResult {
  success: boolean;
  filename: string;
  message?: string;
}

export function ImportDialog({ open, onOpenChange, onImportComplete }: ImportDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResults([]);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResults([]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setResults([]);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/workflows/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const data = await response.json();

      // Handle results
      if (Array.isArray(data.results)) {
        setResults(data.results);
      } else if (data.success) {
        setResults([{
          success: true,
          filename: data.filename || selectedFile.name,
          message: data.message,
        }]);
      }

      // Call completion callback after a delay
      setTimeout(() => {
        if (onImportComplete) {
          onImportComplete();
        }
      }, 1500);
    } catch (error) {
      setResults([{
        success: false,
        filename: selectedFile.name,
        message: error instanceof Error ? error.message : 'Unknown error',
      }]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setResults([]);
    onOpenChange(false);
  };

  const isValidFile = (file: File | null): boolean => {
    if (!file) return false;
    const validExtensions = ['.md', '.yaml', '.yml', '.zip'];
    return validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  const getFileIcon = (filename: string) => {
    if (filename.endsWith('.zip')) {
      return <Archive className="w-5 h-5 text-purple-400" />;
    }
    return <FileText className="w-5 h-5 text-blue-400" />;
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Import Workflow"
      description="Upload workflow files from your computer"
      size="md"
    >
      <div className="p-4 space-y-4">
        {/* File Upload Area */}
        {!selectedFile && results.length === 0 && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${dragActive
                ? 'border-primary bg-primary/10'
                : 'border-node-border hover:border-primary/50 hover:bg-white/5'
              }
            `}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <p className="text-sm text-gray-300 mb-2">
              Drag and drop a file here, or click to browse
            </p>
            <p className="text-xs text-gray-500">
              Supported formats: .md, .yaml, .yml, .zip
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.yaml,.yml,.zip"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* Selected File */}
        {selectedFile && results.length === 0 && (
          <div className="border border-node-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              {getFileIcon(selectedFile.name)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
              {!isValidFile(selectedFile) && (
                <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
              )}
            </div>

            {!isValidFile(selectedFile) && (
              <p className="text-xs text-error mt-2">
                Invalid file type. Please select a .md, .yaml, .yml, or .zip file.
              </p>
            )}
          </div>
        )}

        {/* Upload Results */}
        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white">Import Results:</h4>
            {results.map((result, index) => (
              <div
                key={index}
                className={`
                  flex items-start gap-3 p-3 rounded-lg border
                  ${result.success
                    ? 'border-success/30 bg-success/10'
                    : 'border-error/30 bg-error/10'
                  }
                `}
              >
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {result.filename}
                  </p>
                  {result.message && (
                    <p className="text-xs text-gray-400 mt-1">
                      {result.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalFooter>
        {results.length > 0 ? (
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={!selectedFile || !isValidFile(selectedFile) || isUploading}
            >
              {isUploading ? 'Uploading...' : 'Import'}
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}
