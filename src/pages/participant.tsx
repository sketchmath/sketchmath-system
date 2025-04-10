import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inter, nanumPenScript } from '@/utils/fonts';
import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { collection, setDoc, doc } from 'firebase/firestore';
import firestoreDb from '@/utils/firestore';
import { toast } from "sonner";

export default function Participant() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    userId: "",
    name: "",
    email: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Only allow numbers for userId
    if (name === "userId" && value !== "" && !/^\d+$/.test(value)) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);

      // Add timestamp to the data
      const dataToSubmit = {
        ...formData,
        createdAt: Date.now(),
      };

      // set localStorage
      localStorage.setItem("userId", formData.userId);
      localStorage.setItem("name", formData.name);
      localStorage.setItem("email", formData.email);

      const userId = parseInt(formData.userId);

      const participantsRef = collection(firestoreDb, "participants");
      await setDoc(doc(participantsRef, formData.userId), dataToSubmit);

      toast("Success!",
        {
          description: "Your information has been saved.",
        });

      // Reset form after successful submission
      setFormData({
        userId: "",
        name: "",
        email: "",
      });

      if (userId <= 6) {
        // navigate to /baseline
        window.location.href = "/baseline";
      } else {
        // navigate to /system
        window.location.href = "/interface";
      }

    } catch (error) {
      console.error("Error adding document: ", error);
      toast("Error", {
        description: "There was a problem saving your information.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${inter.className} h-dvh w-full flex items-center justify-center p-4`}>
      <div className="flex flex-col gap-4 items-center w-1/2">
        <h1 className={`${nanumPenScript.className} text-8xl`}>SketchSense</h1>
        <div className="flex flex-col flex-1 gap-4 mt-2 w-2/3">
          <Card className="w-full mx-auto">
            <CardHeader>
              <CardTitle>Participant Information</CardTitle>
              <CardDescription>Enter your details for this user study.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="userId">User ID</Label>
                  <Input
                    id="userId"
                    name="userId"
                    placeholder="Enter user ID"
                    value={formData.userId}
                    onChange={handleChange}
                    required
                    aria-describedby="userId-description"
                  />
                  <p id="userId-description" className="text-xs text-muted-foreground">
                    User ID must contain only numbers.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Participant Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </CardContent>

              <CardFooter className="flex justify-between gap-2 mt-1">
                <Button asChild variant="outline" size="icon" type="button" className="px-4" disabled={isSubmitting}>
                  <Link href="/">
                    <ArrowLeftIcon size={16} />
                  </Link>
                </Button>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}