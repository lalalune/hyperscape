import { Download } from "lucide-react";
import React from "react";

import type { HandRiggingResult } from "../../services/hand-rigging/HandRiggingService";
import type { SimpleHandRiggingResult } from "../../services/hand-rigging/SimpleHandRiggingService";
import type { Asset } from "../../types";
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from "../common";

interface ExportModalProps {
  showModal: boolean;
  selectedAvatar: Asset | null;
  riggingResult: HandRiggingResult | SimpleHandRiggingResult | null;
  onClose: () => void;
  onExport: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  showModal,
  selectedAvatar,
  riggingResult,
  onClose,
  onExport,
}) => {
  return (
    <Modal open={showModal} onClose={onClose}>
      <ModalHeader>
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" />
          Export Rigged Model
        </h3>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <div className="p-4 bg-primary/10 rounded-lg">
            <p className="text-sm text-text-primary font-medium mb-2">
              Your model is ready for export!
            </p>
            <p className="text-xs text-text-secondary">
              The exported model includes all original bones plus the newly
              added hand bones, ready for use in game engines or animation
              software.
            </p>
          </div>

          {selectedAvatar && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">
                Export Details:
              </p>
              <div className="space-y-1 text-xs text-text-secondary">
                <div className="flex justify-between">
                  <span>Original Avatar:</span>
                  <span className="font-mono">{selectedAvatar.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Export Format:</span>
                  <span className="font-mono">.glb</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Bones:</span>
                  <span className="font-mono">
                    {riggingResult
                      ? riggingResult.metadata.originalBoneCount +
                        riggingResult.metadata.addedBoneCount
                      : 0}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter className="flex gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onExport}>
          <Download className="w-4 h-4 mr-2" />
          Download Model
        </Button>
      </ModalFooter>
    </Modal>
  );
};
