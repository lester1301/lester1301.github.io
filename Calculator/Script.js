const display = document.querySelector(".display");

const numberButtons = document.querySelectorAll(".number");
const operatorButtons = document.querySelectorAll(".operator");

const equalsButton = document.querySelector(".equals");
const clearButton = document.querySelector(".clear");
const plusMinusButton = document.querySelector(".plus-minus");
const percentageButton = document.querySelector(".percentage");
const backspaceButton = document.querySelector(".backspace");

let firstNumber = "";
let operator = "";
let justCalculated = false;


// ================= BUTTON ANIMATION =================

function animateButton(button) {

    if (!button) return;

    button.classList.add("keyboard-active");

    setTimeout(function() {

        button.classList.remove("keyboard-active");

    }, 100);

}


// ================= NUMBER BUTTONS =================

numberButtons.forEach(function(button) {

    button.addEventListener("click", function() {

        if (justCalculated) {

            display.innerText = "";

            firstNumber = "";
            operator = "";

            justCalculated = false;

        }

        // Decimal
        if (button.innerText === ".") {

            if (!display.innerText.includes(".")) {

                display.innerText += ".";

            }

        }

        // Numbers
        else {

            if (display.innerText === "0") {

                display.innerText = button.innerText;

            } else {

                display.innerText += button.innerText;

            }

        }

    });

});


// ================= OPERATORS =================

operatorButtons.forEach(function(button) {

    button.addEventListener("click", function() {

        // Agar abhi-abhi calculation hui hai
        if (justCalculated) {

            firstNumber = display.innerText;

            operator = button.innerText;

            display.innerText = "";

            justCalculated = false;

            return;

        }


        // Agar calculation already chal rahi hai
        if (
            firstNumber !== "" &&
            operator !== "" &&
            display.innerText !== ""
        ) {

            const secondNumber = display.innerText;

            let result;


            if (operator === "+") {

                result =
                    Number(firstNumber) +
                    Number(secondNumber);

            }


            if (operator === "−") {

                result =
                    Number(firstNumber) -
                    Number(secondNumber);

            }


            if (operator === "×") {

                result =
                    Number(firstNumber) *
                    Number(secondNumber);

            }


            if (operator === "÷") {

                if (Number(secondNumber) === 0) {

                    display.innerText = "Error";

                    firstNumber = "";
                    operator = "";

                    return;

                }

                result =
                    Number(firstNumber) /
                    Number(secondNumber);

            }


            display.innerText = result;

            firstNumber = result;

        }

        else {

            firstNumber = display.innerText;

        }


        operator = button.innerText;

        display.innerText = "";

    });

});


// ================= EQUALS =================

equalsButton.addEventListener("click", function() {

    if (
        firstNumber === "" ||
        operator === ""
    ) {

        return;

    }


    const secondNumber = display.innerText;

    let result;


    if (operator === "+") {

        result =
            Number(firstNumber) +
            Number(secondNumber);

    }


    if (operator === "−") {

        result =
            Number(firstNumber) -
            Number(secondNumber);

    }


    if (operator === "×") {

        result =
            Number(firstNumber) *
            Number(secondNumber);

    }


    if (operator === "÷") {

        if (Number(secondNumber) === 0) {

            display.innerText = "Error";

            firstNumber = "";
            operator = "";

            return;

        }

        result =
            Number(firstNumber) /
            Number(secondNumber);

    }


    display.innerText = result;

    firstNumber = result;

    justCalculated = true;

});


// ================= CLEAR =================

clearButton.addEventListener("click", function() {

    display.innerText = "0";

    firstNumber = "";
    operator = "";

    justCalculated = false;

});


// ================= PLUS / MINUS =================

plusMinusButton.addEventListener("click", function() {

    if (display.innerText !== "0") {

        display.innerText =
            -Number(display.innerText);

    }

});


// ================= PERCENTAGE =================

percentageButton.addEventListener("click", function() {

    if (display.innerText !== "0") {

        display.innerText =
            Number(display.innerText) / 100;

    }

});


// ================= OPERATOR FUNCTION =================

function clickOperator(symbol) {

    operatorButtons.forEach(function(button) {

        if (button.innerText === symbol) {

            button.click();

        }

    });

}


// ================= BACKSPACE =================

backspaceButton.addEventListener("click", function() {

    if (display.innerText.length > 1) {

        display.innerText =
            display.innerText.slice(0, -1);

    }

    else {

        display.innerText = "0";

    }

});


// ================= KEYBOARD =================

document.addEventListener("keydown", function(event) {

    const key = event.key;


    // ================= NUMBERS =================

    if (key >= "0" && key <= "9") {

        const button =
            [...numberButtons].find(function(btn) {

                return btn.innerText === key;

            });

        animateButton(button);


        if (justCalculated) {

            display.innerText = key;

            firstNumber = "";
            operator = "";

            justCalculated = false;

        }

        else if (display.innerText === "0") {

            display.innerText = key;

        }

        else {

            display.innerText += key;

        }

    }


    // ================= DECIMAL =================

    else if (key === ".") {

        const button =
            [...numberButtons].find(function(btn) {

                return btn.innerText === ".";

            });

        animateButton(button);


        if (!display.innerText.includes(".")) {

            display.innerText += ".";

        }

    }


    // ================= ADDITION =================

    else if (key === "+") {

        const button =
            [...operatorButtons].find(function(btn) {

                return btn.innerText === "+";

            });

        animateButton(button);

        clickOperator("+");

    }


    // ================= SUBTRACTION =================

    else if (key === "-") {

        const button =
            [...operatorButtons].find(function(btn) {

                return btn.innerText === "−";

            });

        animateButton(button);

        clickOperator("−");

    }


    // ================= MULTIPLICATION =================

    else if (key === "*") {

        const button =
            [...operatorButtons].find(function(btn) {

                return btn.innerText === "×";

            });

        animateButton(button);

        clickOperator("×");

    }


    // ================= DIVISION =================

    else if (key === "/") {

        const button =
            [...operatorButtons].find(function(btn) {

                return btn.innerText === "÷";

            });

        animateButton(button);

        clickOperator("÷");

    }


    // ================= ENTER =================

    else if (key === "Enter") {

        event.preventDefault();

        animateButton(equalsButton);

        equalsButton.click();

    }


    // ================= ESCAPE / AC =================

    else if (key === "Escape") {

        animateButton(clearButton);

        clearButton.click();

    }


    // ================= BACKSPACE =================

    else if (key === "Backspace") {

        animateButton(backspaceButton);

        backspaceButton.click();

    }

});