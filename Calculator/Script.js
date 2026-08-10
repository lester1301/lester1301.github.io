const expression = document.querySelector(".expression");
const resultDisplay = document.querySelector(".result");

const numberButtons = document.querySelectorAll(".number");
const operatorButtons = document.querySelectorAll(".operator");

const equalsButton = document.querySelector(".equals");
const clearButton = document.querySelector(".clear");
const plusMinusButton = document.querySelector(".plus-minus");
const percentageButton = document.querySelector(".percentage");
const backspaceButton = document.querySelector(".backspace");


// ========================================
// CALCULATOR VARIABLES
// ========================================

let firstNumber = "";
let operator = "";

let justCalculated = false;


// ========================================
// NUMBER BUTTONS
// ========================================

numberButtons.forEach(function(button) {

    button.addEventListener("click", function() {

        // Agar abhi calculation hui hai
        // aur user naya number press karta hai
        if (justCalculated) {

            expression.innerText = "";

            resultDisplay.innerText = "0";

            firstNumber = "";
            operator = "";

            justCalculated = false;
        }


        // Decimal
        if (button.innerText === ".") {

            if (!resultDisplay.innerText.includes(".")) {

                resultDisplay.innerText += ".";

            }

        }

        // Normal number
        else {

            if (resultDisplay.innerText === "0") {

                resultDisplay.innerText = button.innerText;

            }

            else {

                resultDisplay.innerText += button.innerText;

            }

        }


        // Agar operator already select hai
        // toh expression update karo

        if (operator !== "") {

            expression.innerText =
                firstNumber +
                " " +
                operator +
                " " +
                resultDisplay.innerText;

        }

    });

});


// ========================================
// OPERATOR BUTTONS
// ========================================

operatorButtons.forEach(function(button) {

    button.addEventListener("click", function() {

        const selectedOperator = button.innerText;


        // Agar calculation ke baad operator press hua
        // Example: 10 + 5

        if (justCalculated) {

            firstNumber = resultDisplay.innerText;

            operator = selectedOperator;

            expression.innerText =
                firstNumber + " " + operator;

            resultDisplay.innerText = "0";

            justCalculated = false;

            return;
        }


        // Agar pehle se first number aur operator hai
        // Example: 7 × 8 ke baad + press

        if (firstNumber !== "" && operator !== "") {

            const secondNumber = resultDisplay.innerText;

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

                    expression.innerText = "";

                    resultDisplay.innerText = "Error";

                    firstNumber = "";
                    operator = "";

                    justCalculated = true;

                    return;
                }


                result =
                    Number(firstNumber) /
                    Number(secondNumber);

            }


            // Result ko next calculation ka first number banao

            firstNumber = result;

        }


        // Agar first number abhi set nahi hai

        else if (firstNumber === "") {

            firstNumber = resultDisplay.innerText;

        }


        operator = selectedOperator;


        // Expression show karo

        expression.innerText =
            firstNumber + " " + operator;


        // Next number ke liye display reset

        resultDisplay.innerText = "0";

    });

});


// ========================================
// EQUALS BUTTON
// ========================================

equalsButton.addEventListener("click", function() {

    // Agar koi operator hi nahi hai
    // toh kuch mat karo

    if (firstNumber === "" || operator === "") {

        return;

    }


    const secondNumber = resultDisplay.innerText;

    let result;


    // Addition

    if (operator === "+") {

        result =
            Number(firstNumber) +
            Number(secondNumber);

    }


    // Subtraction

    if (operator === "−") {

        result =
            Number(firstNumber) -
            Number(secondNumber);

    }


    // Multiplication

    if (operator === "×") {

        result =
            Number(firstNumber) *
            Number(secondNumber);

    }


    // Division

    if (operator === "÷") {

        if (Number(secondNumber) === 0) {

            expression.innerText =
                firstNumber +
                " " +
                operator +
                " " +
                secondNumber;

            resultDisplay.innerText = "Error";

            firstNumber = "";
            operator = "";

            justCalculated = true;

            return;
        }


        result =
            Number(firstNumber) /
            Number(secondNumber);

    }


    // ====================================
    // FINAL DISPLAY
    // ====================================

    expression.innerText =
        firstNumber +
        " " +
        operator +
        " " +
        secondNumber;


    resultDisplay.innerText = result;


    // Calculation complete

    justCalculated = true;

});


// ========================================
// CLEAR / AC
// ========================================

clearButton.addEventListener("click", function() {

    expression.innerText = "";

    resultDisplay.innerText = "0";

    firstNumber = "";

    operator = "";

    justCalculated = false;

});


// ========================================
// PLUS / MINUS
// ========================================

plusMinusButton.addEventListener("click", function() {

    if (resultDisplay.innerText !== "0") {

        resultDisplay.innerText =
            -Number(resultDisplay.innerText);


        // Expression update

        if (operator !== "") {

            expression.innerText =
                firstNumber +
                " " +
                operator +
                " " +
                resultDisplay.innerText;

        }

    }

});


// ========================================
// PERCENTAGE
// ========================================

percentageButton.addEventListener("click", function() {

    if (resultDisplay.innerText !== "0") {

        resultDisplay.innerText =
            Number(resultDisplay.innerText) / 100;


        // Expression update

        if (operator !== "") {

            expression.innerText =
                firstNumber +
                " " +
                operator +
                " " +
                resultDisplay.innerText;

        }

    }

});


// ========================================
// BACKSPACE
// ========================================

backspaceButton.addEventListener("click", function() {

    // Agar calculation ke baad backspace dabaya
    // toh result ko edit karne denge

    if (resultDisplay.innerText === "Error") {

        return;

    }


    if (resultDisplay.innerText.length > 1) {

        resultDisplay.innerText =
            resultDisplay.innerText.slice(0, -1);

    }

    else {

        resultDisplay.innerText = "0";

    }


    // Expression update

    if (operator !== "") {

        expression.innerText =
            firstNumber +
            " " +
            operator +
            " " +
            resultDisplay.innerText;

    }

});


// ========================================
// OPERATOR HELPER
// ========================================

function clickOperator(symbol) {

    operatorButtons.forEach(function(button) {

        if (button.innerText === symbol) {

            button.click();

        }

    });

}


// ========================================
// KEYBOARD SUPPORT
// ========================================

document.addEventListener("keydown", function(event) {

    const key = event.key;


    // ====================================
    // NUMBER KEYS
    // ====================================

    if (key >= "0" && key <= "9") {

        const button =
            Array.from(numberButtons).find(function(btn) {

                return btn.innerText === key;

            });


        if (button) {

            button.click();

        }

    }


    // ====================================
    // DECIMAL
    // ====================================

    else if (key === ".") {

        const decimalButton =
            Array.from(numberButtons).find(function(btn) {

                return btn.innerText === ".";

            });


        if (decimalButton) {

            decimalButton.click();

        }

    }


    // ====================================
    // ADDITION
    // ====================================

    else if (key === "+") {

        clickOperator("+");

    }


    // ====================================
    // SUBTRACTION
    // ====================================

    else if (key === "-") {

        clickOperator("−");

    }


    // ====================================
    // MULTIPLICATION
    // ====================================

    else if (key === "*") {

        clickOperator("×");

    }


    // ====================================
    // DIVISION
    // ====================================

    else if (key === "/") {

        event.preventDefault();

        clickOperator("÷");

    }


    // ====================================
    // ENTER
    // ====================================

    else if (key === "Enter" || key === "=") {

        event.preventDefault();

        equalsButton.click();

    }


    // ====================================
    // ESCAPE / AC
    // ====================================

    else if (key === "Escape") {

        clearButton.click();

    }


    // ====================================
    // BACKSPACE
    // ====================================

    else if (key === "Backspace") {

        event.preventDefault();

        backspaceButton.click();

    }

});