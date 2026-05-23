using UnityEngine;
using UnityEngine.InputSystem;

public class XRITMenuBinder : MonoBehaviour
{
    [SerializeField]
    private WristMenuToggle wristMenu;

    [SerializeField]
    private InputActionReference toggleAction;

    private void OnEnable()
    {
        if (toggleAction == null)
            return;

        toggleAction.action.Enable();
        toggleAction.action.performed += HandleToggle;
    }

    private void OnDisable()
    {
        if (toggleAction == null)
            return;

        toggleAction.action.performed -= HandleToggle;
        toggleAction.action.Disable();
    }

    private void HandleToggle(
        InputAction.CallbackContext context)
    {
        wristMenu?.Toggle();
    }
}