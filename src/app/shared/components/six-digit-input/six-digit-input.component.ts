import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonInput } from '@ionic/angular/standalone';

@Component({
  selector: 'app-six-digit-input',
  templateUrl: './six-digit-input.component.html',
  styleUrls: ['./six-digit-input.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonInput],
})
export class SixDigitInputComponent implements AfterViewInit {
  @Input() code = '';
  @Output() codeChange = new EventEmitter<string>();
  @Output() codeComplete = new EventEmitter<string>();

  digits: string[] = ['', '', '', '', '', ''];
  private currentFocusedIndex = 0;
  @ViewChild('input0') input0!: ElementRef<HTMLIonInputElement>;
  @ViewChild('input1') input1!: ElementRef<HTMLIonInputElement>;
  @ViewChild('input2') input2!: ElementRef<HTMLIonInputElement>;
  @ViewChild('input3') input3!: ElementRef<HTMLIonInputElement>;
  @ViewChild('input4') input4!: ElementRef<HTMLIonInputElement>;
  @ViewChild('input5') input5!: ElementRef<HTMLIonInputElement>;

  ngAfterViewInit() {
    if (this.code) {
      this.digits = this.code.split('');
      this.updateCode();
    }
  }

  onInput(index: number, event: any) {
    this.currentFocusedIndex = index;
    const value = event.target.value;
    
    // Handle multi-character input (paste or rapid typing)
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').split('');
      let currentIndex = index;
      
      // Distribute digits across fields starting from current index
      for (let i = 0; i < digits.length && currentIndex < 6; i++) {
        this.digits[currentIndex] = digits[i];
        currentIndex++;
      }
      
      this.updateCode();
      
      // Focus the next empty field or the last filled field
      const nextIndex = Math.min(currentIndex - 1, 5);
      if (this.isComplete()) {
        // If complete, focus the last field
        setTimeout(() => this.input5.nativeElement.setFocus(), 10);
        this.codeComplete.emit(this.code);
      } else if (nextIndex < 5) {
        // Focus the next empty field
        this.focusNext(nextIndex);
      } else {
        // Focus the last field
        setTimeout(() => this.input5.nativeElement.setFocus(), 10);
      }
      return;
    }
    
    // Handle single character input
    this.digits[index] = value;

    this.updateCode();

    if (value && index < 5) {
      this.focusNext(index);
    }

    if (this.isComplete()) {
      this.codeComplete.emit(this.code);
    }
  }

  onFocus(index: number) {
    this.currentFocusedIndex = index;
  }

  onKeyDown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) {
      this.focusPrevious(index);
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('');
    
    if (digits.length === 0) {
      return;
    }
    
    // Use the currently focused index, or find the first empty field
    let startIndex = this.currentFocusedIndex;
    const firstEmptyIndex = this.digits.findIndex(d => d === '');
    if (firstEmptyIndex >= 0 && firstEmptyIndex < startIndex) {
      startIndex = firstEmptyIndex;
    }
    
    // Fill digits starting from the determined index
    for (let i = 0; i < digits.length && (startIndex + i) < 6; i++) {
      this.digits[startIndex + i] = digits[i];
    }
    
    // Clear remaining digits if pasted code is shorter than 6
    const endIndex = Math.min(startIndex + digits.length, 6);
    for (let i = endIndex; i < 6; i++) {
      this.digits[i] = '';
    }

    this.updateCode();
    
    // Focus the next empty field or the last filled field
    const nextIndex = Math.min(startIndex + digits.length - 1, 5);
    if (this.isComplete()) {
      // If complete, focus the last field
      this.currentFocusedIndex = 5;
      setTimeout(() => this.input5.nativeElement.setFocus(), 10);
      this.codeComplete.emit(this.code);
    } else if (nextIndex < 5) {
      // Focus the next empty field
      this.focusNext(nextIndex);
    } else {
      // Focus the last field
      this.currentFocusedIndex = 5;
      setTimeout(() => this.input5.nativeElement.setFocus(), 10);
    }
  }

  private focusNext(index: number) {
    const inputs = [this.input0, this.input1, this.input2, this.input3, this.input4, this.input5];
    if (inputs[index + 1]) {
      this.currentFocusedIndex = index + 1;
      setTimeout(() => {
        inputs[index + 1].nativeElement.setFocus();
      }, 10);
    }
  }

  private focusPrevious(index: number) {
    const inputs = [this.input0, this.input1, this.input2, this.input3, this.input4, this.input5];
    if (inputs[index - 1]) {
      this.currentFocusedIndex = index - 1;
      setTimeout(() => inputs[index - 1].nativeElement.setFocus(), 10);
    }
  }

  private updateCode() {
    this.code = this.digits.join('');
    this.codeChange.emit(this.code);
  }

  private isComplete(): boolean {
    return this.digits.every(d => d !== '');
  }
}

