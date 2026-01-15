"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PinInput } from "@/components/forms/pin-input";
import { usePinAuth } from "@/lib/hooks/use-auth";
import { Loader2, Shield } from "lucide-react";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const { signInAnonymously, verifyPin, isLoading, error } = usePinAuth();
  const [step, setStep] = useState<"anonymous" | "pin">("anonymous");

  const handleAnonymousSignIn = async () => {
    const result = await signInAnonymously();
    if (result.success) {
      setStep("pin");
    }
  };

  const handlePinSubmit = async (enteredPin: string) => {
    await verifyPin(enteredPin);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-2xl">Welcome to BudgetBud</CardTitle>
        <CardDescription>
          {step === "anonymous"
            ? "Sign in to access your personal budgeting dashboard"
            : "Enter your 6-digit PIN to continue"
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {step === "anonymous" ? (
          <div className="space-y-4">
            <Button
              onClick={handleAnonymousSignIn}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Continue to BudgetBud"
              )}
            </Button>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <PinInput
              value={pin}
              onChange={setPin}
              onComplete={handlePinSubmit}
              disabled={isLoading}
              error={error || undefined}
            />

            <Button
              onClick={() => handlePinSubmit(pin)}
              disabled={isLoading || pin.length !== 4}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying PIN...
                </>
              ) : (
                "Enter BudgetBud"
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                setStep("anonymous");
                setPin("");
              }}
              disabled={isLoading}
              className="w-full"
            >
              Back
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
