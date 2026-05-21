using Mirror;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.XR.Interaction.Toolkit;

[InitializeOnLoad]
public static class XRPresenceValidator
{
    static XRPresenceValidator()
    {
        EditorApplication.delayCall += () =>
        {
            if (!EditorApplication.isPlayingOrWillChangePlaymode)
                ValidateScene();
        };
        EditorSceneManager.sceneOpened += (scene, mode) => ValidateScene();
        EditorSceneManager.sceneSaved += (scene) => ValidateScene();
    }
    private const string Label = "[XR_SETUP]";

    [MenuItem("Tools/XR Presence/Validate Current Scene", priority = 100)]
    private static void ValidateScene()
    {
        int issues = 0;
        issues += CheckXROrigin();
        issues += CheckTrackingBridge();
        issues += CheckPlayerPrefab();
        issues += CheckScenePrefabs();

        if (issues == 0)
            Debug.Log($"{Label} All checks passed.");
        else
            Debug.LogWarning($"{Label} {issues} issue(s) found. See messages above.");
    }

    [MenuItem("Tools/XR Presence/Auto-Setup Tracking Bridge", priority = 101)]
    private static void AutoSetupTrackingBridge()
    {
        GameObject xrOrigin = FindXROrigin();
        if (xrOrigin == null)
        {
            Debug.LogError($"{Label} No XR Origin found. Add XR Interaction Setup to the scene first.");
            return;
        }

        Camera cam = xrOrigin.GetComponentInChildren<Camera>();
        ActionBasedController[] controllers = xrOrigin.GetComponentsInChildren<ActionBasedController>();
        Transform leftCtrl = null, rightCtrl = null;
        foreach (ActionBasedController c in controllers)
        {
            if (leftCtrl == null && c.name.ToLower().Contains("left")) leftCtrl = c.transform;
            else if (rightCtrl == null && c.name.ToLower().Contains("right")) rightCtrl = c.transform;
        }

        if (cam == null) { Debug.LogError($"{Label} No Camera found under XR Origin."); return; }

        GameObject bridgeGO = new GameObject("XRTrackingBridge");
        Undo.RegisterCreatedObjectUndo(bridgeGO, "Create XRTrackingBridge");
        XRTrackingBridge bridge = bridgeGO.AddComponent<XRTrackingBridge>();

        SerializedObject so = new SerializedObject(bridge);
        so.FindProperty("xrOrigin").objectReferenceValue = xrOrigin.transform;
        so.FindProperty("headSource").objectReferenceValue = cam.transform;
        so.FindProperty("leftHandSource").objectReferenceValue = leftCtrl;
        so.FindProperty("rightHandSource").objectReferenceValue = rightCtrl;
        so.ApplyModifiedProperties();

        Selection.activeGameObject = bridgeGO;
        EditorSceneManager.MarkSceneDirty(SceneManager.GetActiveScene());
        Debug.Log($"{Label} XRTrackingBridge created and wired. References set in Inspector.");
    }

    [MenuItem("Tools/XR Presence/Auto-Setup Tracking Bridge", validate = true)]
    private static bool AutoSetupTrackingBridgeValidate()
    {
        return FindXROrigin() != null && UnityEngine.Object.FindObjectOfType<XRTrackingBridge>() == null;
    }

    private static int CheckXROrigin()
    {
        GameObject origin = FindXROrigin();
        if (origin == null)
        {
            Debug.LogWarning($"{Label} No XR Origin found in the scene. " +
                "Add the XR Interaction Setup prefab (Starter Assets) to your scene.");
            return 1;
        }

        Camera cam = origin.GetComponentInChildren<Camera>();
        ActionBasedController[] controllers = origin.GetComponentsInChildren<ActionBasedController>();
        int count = controllers.Length;

        if (cam == null) { Debug.LogWarning($"{Label} XR Origin has no Camera."); return 1; }
        if (count == 0) { Debug.LogWarning($"{Label} XR Origin has no ActionBasedControllers."); return 1; }

        bool hasLeft = false, hasRight = false;
        foreach (ActionBasedController c in controllers)
        {
            if (c.name.ToLower().Contains("left")) hasLeft = true;
            if (c.name.ToLower().Contains("right")) hasRight = true;
        }
        if (!hasLeft) Debug.LogWarning($"{Label} No Left controller found.");
        if (!hasRight) Debug.LogWarning($"{Label} No Right controller found.");

        return 0;
    }

    private static int CheckTrackingBridge()
    {
        XRTrackingBridge bridge = UnityEngine.Object.FindObjectOfType<XRTrackingBridge>();
        if (bridge == null)
        {
            Debug.LogWarning($"{Label} No XRTrackingBridge in scene. " +
                "Use Tools > XR Presence > Auto-Setup Tracking Bridge to create one.");
            return 1;
        }

        int missing = 0;
        SerializedObject so = new SerializedObject(bridge);
        if (so.FindProperty("xrOrigin").objectReferenceValue == null)
        { Debug.LogWarning($"{Label} XRTrackingBridge.xrOrigin is unset."); missing++; }
        if (so.FindProperty("headSource").objectReferenceValue == null)
        { Debug.LogWarning($"{Label} XRTrackingBridge.headSource is unset."); missing++; }
        if (so.FindProperty("leftHandSource").objectReferenceValue == null)
        { Debug.LogWarning($"{Label} XRTrackingBridge.leftHandSource is unset."); missing++; }
        if (so.FindProperty("rightHandSource").objectReferenceValue == null)
        { Debug.LogWarning($"{Label} XRTrackingBridge.rightHandSource is unset."); missing++; }

        return missing > 0 ? 1 : 0;
    }

    private static int CheckPlayerPrefab()
    {
        NetworkManager net = UnityEngine.Object.FindObjectOfType<NetworkManager>();
        if (net == null)
        {
            Debug.LogWarning($"{Label} No NetworkManager in scene. " +
                "Add XRNetworkManager prefab.");
            return 1;
        }

        if (net.playerPrefab == null)
        {
            Debug.LogWarning($"{Label} NetworkManager.playerPrefab is not set. " +
                "Assign XRRuntimeParticipantRoot.");
            return 1;
        }

        return 0;
    }

    private static int CheckScenePrefabs()
    {
        XRRuntimeParticipant[] instances = UnityEngine.Object.FindObjectsOfType<XRRuntimeParticipant>();
        if (instances.Length > 0)
        {
            Debug.LogWarning($"{Label} Found {instances.Length} XRRuntimeParticipant in the scene. " +
                "These are networked prefabs and should NOT be placed in the scene. " +
                "Remove them and set NetworkManager.playerPrefab instead.");
            return 1;
        }
        return 0;
    }

    private static GameObject FindXROrigin()
    {
        GameObject origin = GameObject.Find("XR Origin (XR Rig)");
        if (origin != null) return origin;
        origin = GameObject.Find("XR Origin");
        if (origin != null) return origin;
        return GameObject.FindObjectOfType<Unity.XR.CoreUtils.XROrigin>()?.gameObject;
    }
}
