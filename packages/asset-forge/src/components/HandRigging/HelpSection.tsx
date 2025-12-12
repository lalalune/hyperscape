import { Info, Zap, Sparkles, CheckCircle, ArrowRight } from "lucide-react";
import React from "react";

import { cn } from "../../styles";
import { Card, CardContent } from "../common";

interface HelpSectionProps {
  useSimpleMode: boolean;
}

export const HelpSection: React.FC<HelpSectionProps> = ({ useSimpleMode }) => {
  return (
    <Card className={cn("mt-6 overflow-hidden", "animate-fade-in")}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Info className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-semibold text-text-primary mb-2">
                How Hand Rigging Works
              </h3>
              <p className="text-sm text-text-secondary">
                This tool automatically adds hand bones to 3D character models
                that don't have them.
                {useSimpleMode
                  ? " Simple mode creates 2 bones per hand (palm and fingers) for basic grab animations."
                  : " AI mode uses computer vision to detect hand poses and create detailed finger bones."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  {useSimpleMode ? "Simple Mode Features" : "AI Mode Features"}
                </h4>
                <ul className="space-y-1.5">
                  {useSimpleMode ? (
                    <>
                      <li className="flex items-start gap-2 text-sm text-text-secondary">
                        <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span>
                          Works with any hand pose (open, closed, fist)
                        </span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-text-secondary">
                        <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span>Fast processing in 5-10 seconds</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-text-secondary">
                        <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span>Perfect for grab and hold animations</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-text-secondary">
                        <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span>No AI detection required</span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-2 text-sm text-text-secondary">
                        <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span>Individual control for each finger</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-text-secondary">
                        <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span>AI-powered hand pose detection</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-text-secondary">
                        <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span>Supports complex hand gestures</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-text-secondary">
                        <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span>Best with open hands in T-pose</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Tips for Best Results
                </h4>
                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2 text-sm text-text-secondary">
                    <ArrowRight className="w-4 h-4 text-primary/60 mt-0.5 flex-shrink-0" />
                    <span>
                      Use models exported from Meshy.ai or similar tools
                    </span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-text-secondary">
                    <ArrowRight className="w-4 h-4 text-primary/60 mt-0.5 flex-shrink-0" />
                    <span>
                      Ensure the model has a proper skeleton hierarchy
                    </span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-text-secondary">
                    <ArrowRight className="w-4 h-4 text-primary/60 mt-0.5 flex-shrink-0" />
                    <span>Check that wrist bones are properly named</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-text-secondary">
                    <ArrowRight className="w-4 h-4 text-primary/60 mt-0.5 flex-shrink-0" />
                    <span>Export will normalize model to standard size</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
