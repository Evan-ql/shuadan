import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({ value, onChange, placeholder = "选择日期", className }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [tempDate, setTempDate] = React.useState<Date | undefined>(value);

  // 当外部 value 变化时同步 tempDate
  React.useEffect(() => {
    setTempDate(value);
  }, [value]);

  // 打开弹窗时，同步当前值到临时变量
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setTempDate(value);
    }
    setOpen(isOpen);
  };

  const handleConfirm = () => {
    onChange(tempDate);
    setOpen(false);
  };

  const handleClear = () => {
    setTempDate(undefined);
    onChange(undefined);
    setOpen(false);
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}/${month}/${day}`;
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-mono text-sm h-9 bg-input/50 border-border hover:bg-input/70",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
          {value ? formatDate(value) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={tempDate}
          onSelect={setTempDate}
          defaultMonth={tempDate || new Date()}
        />
        <div className="flex items-center justify-between border-t border-border/30 p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            清除
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            className="text-xs px-6"
          >
            确定
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
